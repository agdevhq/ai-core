import { trace } from '@opentelemetry/api';
import {
    BasicTracerProvider,
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from './errors.ts';
import { generate } from './generate.ts';
import type { ChatModel, GenerateResult } from './types.ts';

function createMockChatModel(result: GenerateResult): ChatModel {
    return {
        provider: 'test',
        modelId: 'test-model',
        generate: vi.fn(async () => result),
        stream: vi.fn(async () => {
            throw new Error('not implemented');
        }),
        generateObject: vi.fn(async () => {
            throw new Error('not implemented');
        }),
        streamObject: vi.fn(async () => {
            throw new Error('not implemented');
        }),
    };
}

describe('generate', () => {
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

    it('should delegate to model.generate', async () => {
        const expected: GenerateResult = {
            parts: [{ type: 'text', text: 'Hello' }],
            content: 'Hello',
            reasoning: null,
            toolCalls: [],
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
        };
        const model = createMockChatModel(expected);

        const result = await generate({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
        });

        expect(result).toEqual(expected);
        expect(model.generate).toHaveBeenCalledWith({
            messages: [{ role: 'user', content: 'Hi' }],
        });
    });

    it('records telemetry attributes and strips telemetry before delegating', async () => {
        const expected: GenerateResult = {
            parts: [{ type: 'text', text: 'Hello' }],
            content: 'Hello',
            reasoning: null,
            toolCalls: [],
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
        };
        const model = createMockChatModel(expected);

        await generate({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
            temperature: 0.3,
            telemetry: {
                isEnabled: true,
                functionId: 'generate-test',
            },
        });

        expect(model.generate).toHaveBeenCalledWith({
            messages: [{ role: 'user', content: 'Hi' }],
            temperature: 0.3,
        });

        const span = exporter.getFinishedSpans()[0];

        expect(span?.name).toBe('chat test-model');
        expect(span?.attributes['gen_ai.provider.name']).toBe('test');
        expect(span?.attributes['gen_ai.request.model']).toBe('test-model');
        expect(span?.attributes['gen_ai.operation.name']).toBe('chat');
        expect(span?.attributes['gen_ai.output.type']).toBe('text');
        expect(span?.attributes['gen_ai.response.finish_reasons']).toEqual(['stop']);
        expect(span?.attributes['gen_ai.usage.input_tokens']).toBe(5);
        expect(span?.attributes['gen_ai.usage.output_tokens']).toBe(3);
        expect(span?.attributes['core_ai.function_id']).toBe('generate-test');
        expect(span?.attributes['gen_ai.input.messages']).toBeDefined();
        expect(span?.attributes['gen_ai.output.messages']).toBeDefined();
        expect(span?.attributes['input.value']).toBeDefined();
        expect(span?.attributes['output.value']).toBe('Hello');
    });

    it('omits content attributes when recordContent is false', async () => {
        const expected: GenerateResult = {
            parts: [{ type: 'text', text: 'Hello' }],
            content: 'Hello',
            reasoning: null,
            toolCalls: [],
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
        };
        const model = createMockChatModel(expected);

        await generate({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
            telemetry: {
                isEnabled: true,
                recordContent: false,
            },
        });

        const span = exporter.getFinishedSpans()[0];

        expect(span?.attributes['gen_ai.input.messages']).toBeUndefined();
        expect(span?.attributes['gen_ai.output.messages']).toBeUndefined();
        expect(span?.attributes['input.value']).toBeUndefined();
        expect(span?.attributes['output.value']).toBeUndefined();
    });

    it('should throw ValidationError for empty messages', async () => {
        const model = createMockChatModel({
            parts: [],
            content: null,
            reasoning: null,
            toolCalls: [],
            finishReason: 'unknown',
            usage: {
                inputTokens: 0,
                outputTokens: 0,
                inputTokenDetails: {
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                },
                outputTokenDetails: {},
            },
        });

        await expect(
            generate({
                model,
                messages: [],
            })
        ).rejects.toBeInstanceOf(ValidationError);
    });
});
