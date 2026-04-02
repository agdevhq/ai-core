import { trace } from '@opentelemetry/api';
import {
    BasicTracerProvider,
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from './errors.ts';
import { stream } from './stream-chat.ts';
import type {
    ChatModel,
    GenerateResult,
    ChatOutputTokenDetails,
    ChatStream,
} from './types.ts';

async function* events(): AsyncIterable<{
    type: 'finish';
    finishReason: 'stop';
    usage: {
        inputTokens: 1;
        outputTokens: 1;
        inputTokenDetails: {
            cacheReadTokens: 0;
            cacheWriteTokens: 0;
        };
        outputTokenDetails: ChatOutputTokenDetails;
    };
}> {
    yield {
        type: 'finish',
        finishReason: 'stop',
        usage: {
            inputTokens: 1,
            outputTokens: 1,
            inputTokenDetails: {
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
            },
            outputTokenDetails: {},
        },
    };
}

function createMockChatStream(): ChatStream {
    const iterable = events();
    return {
        [Symbol.asyncIterator]() {
            return iterable[Symbol.asyncIterator]();
        },
        result: Promise.resolve({
            parts: [],
            content: null,
            reasoning: null,
            toolCalls: [],
            finishReason: 'stop',
            usage: {
                inputTokens: 1,
                outputTokens: 1,
                inputTokenDetails: {
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                },
                outputTokenDetails: {
                    reasoningTokens: 0,
                },
            },
        }),
        events: Promise.resolve([]),
    };
}

function createDeferred<T>(): {
    promise: Promise<T>;
    resolve(value: T): void;
    reject(error: unknown): void;
} {
    let resolve: ((value: T) => void) | undefined;
    let reject: ((error: unknown) => void) | undefined;

    return {
        promise: new Promise<T>((resolvePromise, rejectPromise) => {
            resolve = resolvePromise;
            reject = rejectPromise;
        }),
        resolve(value: T) {
            resolve?.(value);
        },
        reject(error: unknown) {
            reject?.(error);
        },
    };
}

describe('stream', () => {
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

    it('should delegate to model.stream', async () => {
        const expected = createMockChatStream();
        const model: ChatModel = {
            provider: 'test',
            modelId: 'test-model',
            generate: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            stream: vi.fn(async () => expected),
            generateObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
        };

        const chatStream = await stream({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
        });

        expect(chatStream).toBe(expected);
        expect(model.stream).toHaveBeenCalledWith({
            messages: [{ role: 'user', content: 'Hi' }],
        });
    });

    it('records telemetry after the stream result resolves', async () => {
        const deferred = createDeferred<GenerateResult>();
        const expected: ChatStream = {
            [Symbol.asyncIterator]() {
                return events()[Symbol.asyncIterator]();
            },
            result: deferred.promise,
            events: Promise.resolve([]),
        };
        const model: ChatModel = {
            provider: 'test',
            modelId: 'test-model',
            generate: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            stream: vi.fn(async () => expected),
            generateObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
        };

        const chatStream = await stream({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
            telemetry: {
                isEnabled: true,
            },
        });

        expect(exporter.getFinishedSpans()).toHaveLength(0);
        expect(model.stream).toHaveBeenCalledWith({
            messages: [{ role: 'user', content: 'Hi' }],
        });

        deferred.resolve({
            parts: [{ type: 'text', text: 'Hello' }],
            content: 'Hello',
            reasoning: null,
            toolCalls: [],
            finishReason: 'stop',
            usage: {
                inputTokens: 3,
                outputTokens: 2,
                inputTokenDetails: {
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                },
                outputTokenDetails: {},
            },
        });

        await expect(chatStream.result).resolves.toMatchObject({
            content: 'Hello',
        });
        await Promise.resolve();

        const span = exporter.getFinishedSpans()[0];

        expect(span?.name).toBe('chat test-model');
        expect(span?.attributes['gen_ai.provider.name']).toBe('test');
        expect(span?.attributes['gen_ai.output.type']).toBe('text');
        expect(span?.attributes['gen_ai.response.finish_reasons']).toEqual(['stop']);
        expect(span?.attributes['gen_ai.usage.input_tokens']).toBe(3);
        expect(span?.attributes['gen_ai.usage.output_tokens']).toBe(2);
        expect(span?.attributes['gen_ai.input.messages']).toBeDefined();
        expect(span?.attributes['gen_ai.output.messages']).toBeDefined();
    });

    it('records an error on the span when the stream result rejects', async () => {
        const deferred = createDeferred<GenerateResult>();
        const expected: ChatStream = {
            [Symbol.asyncIterator]() {
                return events()[Symbol.asyncIterator]();
            },
            result: deferred.promise,
            events: Promise.resolve([]),
        };
        const model: ChatModel = {
            provider: 'test',
            modelId: 'test-model',
            generate: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            stream: vi.fn(async () => expected),
            generateObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
        };

        const chatStream = await stream({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
            telemetry: {
                isEnabled: true,
            },
        });

        deferred.reject(new Error('stream failed'));

        await expect(chatStream.result).rejects.toThrow('stream failed');
        await Promise.resolve();

        const span = exporter.getFinishedSpans()[0];

        expect(span?.status.message).toBe('stream failed');
        expect(span?.attributes['error.type']).toBe('Error');
    });

    it('should throw ValidationError for empty messages', async () => {
        const model: ChatModel = {
            provider: 'test',
            modelId: 'test-model',
            generate: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            stream: vi.fn(async () => createMockChatStream()),
            generateObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }),
        };

        await expect(
            stream({
                model,
                messages: [],
            })
        ).rejects.toBeInstanceOf(ValidationError);
    });
});
