import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
    BasicTracerProvider,
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
    endSpan,
    recordChatInputContent,
    recordChatOutputContent,
    recordEmbedInputContent,
    recordImageInputContent,
    recordObjectOutputContent,
    startSpan,
    withSpan,
} from './telemetry.ts';
import type { GenerateObjectResult, GenerateResult, Message } from './types.ts';

function expectDefined<T>(value: T | undefined): T {
    expect(value).toBeDefined();

    if (value === undefined) {
        throw new Error('expected value to be defined');
    }

    return value;
}

describe('telemetry', () => {
    let exporter: InMemorySpanExporter;
    let provider: BasicTracerProvider;

    beforeEach(() => {
        trace.disable();
        exporter = new InMemorySpanExporter();
        provider = new BasicTracerProvider({
            spanProcessors: [new SimpleSpanProcessor(exporter)],
        });
        trace.setGlobalTracerProvider(provider);
    });

    afterEach(async () => {
        await provider.shutdown();
        trace.disable();
        vi.resetModules();
        vi.doUnmock('node:module');
    });

    it('returns the callback result when telemetry is disabled', async () => {
        const result = await withSpan(
            {
                name: 'gen_ai chat',
                attributes: {
                    'gen_ai.provider.name': 'test',
                },
                telemetry: {
                    isEnabled: false,
                },
            },
            async (span) => {
                expect(span).toBeUndefined();
                return 'ok';
            }
        );

        expect(result).toBe('ok');
        expect(exporter.getFinishedSpans()).toHaveLength(0);
    });

    it('creates a span with attributes when telemetry is enabled', async () => {
        const result = await withSpan(
            {
                name: 'gen_ai chat',
                attributes: {
                    'gen_ai.provider.name': 'test',
                    'gen_ai.request.model': 'gpt-test',
                },
                telemetry: {
                    isEnabled: true,
                    functionId: 'summarize',
                    metadata: {
                        team: 'ai',
                    },
                },
            },
            async (span) => {
                expect(span).toBeDefined();
                return 'ok';
            }
        );

        expect(result).toBe('ok');

        const span = expectDefined(exporter.getFinishedSpans()[0]);
        expect(span.name).toBe('gen_ai chat');
        expect(span.kind).toBe(SpanKind.CLIENT);
        expect(span.attributes['gen_ai.provider.name']).toBe('test');
        expect(span.attributes['gen_ai.request.model']).toBe('gpt-test');
        expect(span.attributes['core_ai.function_id']).toBe('summarize');
        expect(span.attributes['core_ai.metadata.team']).toBe('ai');
        expect(span.status.code).toBe(SpanStatusCode.OK);
    });

    it('records errors on the span and rethrows them', async () => {
        await expect(
            withSpan(
                {
                    name: 'gen_ai chat',
                    attributes: {},
                    telemetry: {
                        isEnabled: true,
                    },
                },
                async () => {
                    throw new Error('boom');
                }
            )
        ).rejects.toThrow('boom');

        const span = expectDefined(exporter.getFinishedSpans()[0]);

        expect(span.status.code).toBe(SpanStatusCode.ERROR);
        expect(span.status.message).toBe('boom');
        expect(span.attributes['error.type']).toBe('Error');
        expect(span.events.some((event) => event.name === 'exception')).toBe(true);
    });

    it('returns undefined from startSpan when telemetry is disabled', () => {
        const span = startSpan({
            name: 'gen_ai chat',
            attributes: {},
            telemetry: {
                isEnabled: false,
            },
        });

        expect(span).toBeUndefined();
        expect(exporter.getFinishedSpans()).toHaveLength(0);
    });

    it('creates a span with startSpan without ending it', () => {
        const span = expectDefined(
            startSpan({
                name: 'gen_ai chat',
                attributes: {
                    'gen_ai.provider.name': 'test',
                },
                telemetry: {
                    isEnabled: true,
                },
            })
        );
        expect(exporter.getFinishedSpans()).toHaveLength(0);

        endSpan(span);

        const finishedSpan = expectDefined(exporter.getFinishedSpans()[0]);
        expect(finishedSpan.name).toBe('gen_ai chat');
        expect(finishedSpan.kind).toBe(SpanKind.CLIENT);
        expect(finishedSpan.attributes['gen_ai.provider.name']).toBe('test');
    });

    it('records structured and generic input attributes for chat content', () => {
        const span = expectDefined(
            startSpan({
                name: 'gen_ai chat',
                attributes: {},
                telemetry: {
                    isEnabled: true,
                },
            })
        );

        const messages: Message[] = [
            {
                role: 'system',
                content: 'You are helpful.',
            },
            {
                role: 'user',
                content: 'Hello',
            },
            {
                role: 'assistant',
                parts: [
                    {
                        type: 'text',
                        text: 'Hi',
                    },
                ],
            },
            {
                role: 'tool',
                toolCallId: 'call-1',
                content: 'ok',
            },
        ];

        recordChatInputContent(span, messages, {
            weather: {
                name: 'weather',
                description: 'Get weather',
                parameters: z.object({
                    city: z.string(),
                }),
            },
        });
        endSpan(span);

        const finishedSpan = expectDefined(exporter.getFinishedSpans()[0]);

        expect(
            JSON.parse(finishedSpan.attributes['gen_ai.system_instructions'] as string)
        ).toEqual([{ type: 'text', content: 'You are helpful.' }]);
        expect(
            JSON.parse(finishedSpan.attributes['gen_ai.input.messages'] as string)
        ).toEqual([
            {
                role: 'user',
                parts: [{ type: 'text', content: 'Hello' }],
            },
            {
                role: 'assistant',
                parts: [{ type: 'text', content: 'Hi' }],
            },
            {
                role: 'tool',
                parts: [
                    {
                        type: 'tool_call_response',
                        id: 'call-1',
                        result: 'ok',
                    },
                ],
            },
        ]);
        expect(JSON.parse(finishedSpan.attributes['input.value'] as string)).toEqual(
            messages
        );
        expect(
            JSON.parse(finishedSpan.attributes['gen_ai.tool.definitions'] as string)
        ).toEqual([
            {
                type: 'function',
                name: 'weather',
                description: 'Get weather',
                parameters: {
                    $schema: 'https://json-schema.org/draft/2020-12/schema',
                    properties: {
                        city: {
                            type: 'string',
                        },
                    },
                    required: ['city'],
                    type: 'object',
                },
            },
        ]);
    });

    it('records structured and generic output attributes for chat content', () => {
        const span = expectDefined(
            startSpan({
                name: 'gen_ai chat',
                attributes: {},
                telemetry: {
                    isEnabled: true,
                },
            })
        );

        const result: GenerateResult = {
            parts: [
                {
                    type: 'text',
                    text: 'Hello there',
                },
            ],
            content: 'Hello there',
            reasoning: null,
            toolCalls: [],
            finishReason: 'stop',
            usage: {
                inputTokens: 1,
                outputTokens: 2,
                inputTokenDetails: {
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                },
                outputTokenDetails: {},
            },
        };

        recordChatOutputContent(span, result);
        endSpan(span);

        const finishedSpan = expectDefined(exporter.getFinishedSpans()[0]);

        expect(
            JSON.parse(finishedSpan.attributes['gen_ai.output.messages'] as string)
        ).toEqual([
            {
                role: 'assistant',
                parts: [{ type: 'text', content: 'Hello there' }],
                finish_reason: 'stop',
            },
        ]);
        expect(finishedSpan.attributes['output.value']).toBe('Hello there');
    });

    it('records output attributes for object results', () => {
        const span = expectDefined(
            startSpan({
                name: 'gen_ai chat',
                attributes: {},
                telemetry: {
                    isEnabled: true,
                },
            })
        );

        const result: GenerateObjectResult<z.ZodObject<{ city: z.ZodString }>> = {
            object: {
                city: 'Berlin',
            },
            finishReason: 'stop',
            usage: {
                inputTokens: 1,
                outputTokens: 2,
                inputTokenDetails: {
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                },
                outputTokenDetails: {},
            },
        };

        recordObjectOutputContent(span, result);
        endSpan(span);

        const finishedSpan = expectDefined(exporter.getFinishedSpans()[0]);

        expect(
            JSON.parse(finishedSpan.attributes['gen_ai.output.messages'] as string)
        ).toEqual([
            {
                role: 'assistant',
                parts: [{ type: 'text', content: JSON.stringify({ city: 'Berlin' }) }],
                finish_reason: 'stop',
            },
        ]);
        expect(finishedSpan.attributes['output.value']).toBe(
            JSON.stringify({ city: 'Berlin' })
        );
    });

    it('records generic input attributes for embedding and image operations', () => {
        const embedSpan = expectDefined(
            startSpan({
                name: 'gen_ai embeddings',
                attributes: {},
                telemetry: {
                    isEnabled: true,
                },
            })
        );
        const imageSpan = expectDefined(
            startSpan({
                name: 'gen_ai image_generation',
                attributes: {},
                telemetry: {
                    isEnabled: true,
                },
            })
        );

        recordEmbedInputContent(embedSpan, ['hello', 'world']);
        recordImageInputContent(imageSpan, 'draw a cat');
        endSpan(embedSpan);
        endSpan(imageSpan);

        const finishedSpans = exporter.getFinishedSpans();

        expect(finishedSpans[0]?.attributes['input.value']).toBe(
            JSON.stringify(['hello', 'world'])
        );
        expect(finishedSpans[1]?.attributes['input.value']).toBe('draw a cat');
    });

    it('falls back to a no-op when the OTel package cannot be loaded', async () => {
        trace.disable();
        vi.resetModules();
        vi.doMock('node:module', () => ({
            createRequire: () => () => {
                throw new Error('module not found');
            },
        }));

        // @ts-expect-error Vite query import is used to force a fresh module instance.
        const telemetry = (await import('./telemetry.ts?missing-otel')) as typeof import('./telemetry.ts');

        const result = await telemetry.withSpan(
            {
                name: 'gen_ai chat',
                attributes: {},
                telemetry: {
                    isEnabled: true,
                },
            },
            async (span: unknown) => {
                expect(span).toBeUndefined();
                return 'ok';
            }
        );

        expect(result).toBe('ok');
    });
});
