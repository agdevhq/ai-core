import { trace } from '@opentelemetry/api';
import {
    BasicTracerProvider,
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ValidationError } from './errors.ts';
import { generateObject } from './generate-object.ts';
import type { ChatModel } from './types.ts';

describe('generateObject', () => {
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
    });

    it('should delegate to model.generateObject', async () => {
        const schema = z.object({
            answer: z.string(),
        });
        const expected = {
            object: { answer: '42' },
            finishReason: 'stop',
            usage: {
                inputTokens: 5,
                outputTokens: 3,
                inputTokenDetails: {
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                },
                outputTokenDetails: {},
            },
        } as const;

        const generateObjectMock = vi.fn(async () => expected);
        const model: ChatModel = {
            provider: 'test',
            modelId: 'test-model',
            generate: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            stream: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            generateObject: generateObjectMock as ChatModel['generateObject'],
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
        };

        const result = await generateObject({
            model,
            messages: [{ role: 'user', content: 'answer with json' }],
            schema,
        });

        expect(result).toEqual(expected);
        expect(generateObjectMock).toHaveBeenCalledTimes(1);
        expect(generateObjectMock).toHaveBeenCalledWith({
            messages: [{ role: 'user', content: 'answer with json' }],
            schema,
        });
    });

    it('records telemetry and strips telemetry before delegating', async () => {
        const schema = z.object({
            answer: z.string(),
        });
        const expected = {
            object: { answer: '42' },
            finishReason: 'stop',
            usage: {
                inputTokens: 5,
                outputTokens: 3,
                inputTokenDetails: {
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                },
                outputTokenDetails: {},
            },
        } as const;

        const generateObjectMock = vi.fn(async () => expected);
        const model: ChatModel = {
            provider: 'test',
            modelId: 'test-model',
            generate: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            stream: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            generateObject: generateObjectMock as ChatModel['generateObject'],
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
        };

        await generateObject({
            model,
            messages: [{ role: 'user', content: 'answer with json' }],
            schema,
            telemetry: {
                isEnabled: true,
            },
        });

        expect(generateObjectMock).toHaveBeenCalledWith({
            messages: [{ role: 'user', content: 'answer with json' }],
            schema,
        });

        const span = exporter.getFinishedSpans()[0];

        expect(span?.name).toBe('chat test-model');
        expect(span?.attributes['gen_ai.provider.name']).toBe('test');
        expect(span?.attributes['gen_ai.response.finish_reasons']).toEqual(['stop']);
        expect(span?.attributes['gen_ai.output.type']).toBe('json');
        expect(span?.attributes['output.value']).toBe(
            JSON.stringify({ answer: '42' })
        );
    });

    it('should throw ValidationError for empty messages', async () => {
        const schema = z.object({
            answer: z.string(),
        });
        const model: ChatModel = {
            provider: 'test',
            modelId: 'test-model',
            generate: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            stream: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            generateObject: vi.fn(async () => {
                throw new Error('not implemented');
            }) as ChatModel['generateObject'],
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
        };

        await expect(
            generateObject({
                model,
                messages: [],
                schema,
            })
        ).rejects.toBeInstanceOf(ValidationError);
    });
});
