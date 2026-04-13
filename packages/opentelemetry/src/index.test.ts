import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
    BasicTracerProvider,
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
    embed,
    generate,
    generateImage,
    generateObject,
    stream,
    wrapChatModel,
    wrapEmbeddingModel,
    wrapImageModel,
} from '@core-ai/core-ai';
import type {
    ChatModel,
    ChatOutputTokenDetails,
    ChatStream,
    EmbeddingModel,
    GenerateResult,
    ImageModel,
} from '@core-ai/core-ai';
import {
    createOtelEmbeddingMiddleware,
    createOtelImageMiddleware,
    createOtelMiddleware,
} from './index.ts';

async function* events(): AsyncIterable<{
    type: 'finish';
    finishReason: 'stop';
    usage: {
        inputTokens: number;
        outputTokens: number;
        inputTokenDetails: {
            cacheReadTokens: number;
            cacheWriteTokens: number;
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

function createChatUsage(): GenerateResult['usage'] {
    return {
        inputTokens: 5,
        outputTokens: 3,
        inputTokenDetails: {
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
        },
        outputTokenDetails: {},
    };
}

function createGenerateResult(content: string): GenerateResult {
    return {
        parts: [{ type: 'text', text: content }],
        content,
        reasoning: null,
        toolCalls: [],
        finishReason: 'stop',
        usage: createChatUsage(),
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

function expectDefined<T>(value: T | undefined): T {
    expect(value).toBeDefined();

    if (value === undefined) {
        throw new Error('expected value to be defined');
    }

    return value;
}

describe('@core-ai/opentelemetry', () => {
    let exporter: InMemorySpanExporter;
    let provider: BasicTracerProvider;
    let contextManager: AsyncLocalStorageContextManager;

    beforeEach(() => {
        trace.disable();
        context.disable();
        contextManager = new AsyncLocalStorageContextManager();
        contextManager.enable();
        context.setGlobalContextManager(contextManager);
        exporter = new InMemorySpanExporter();
        provider = new BasicTracerProvider({
            spanProcessors: [new SimpleSpanProcessor(exporter)],
        });
        trace.setGlobalTracerProvider(provider);
    });

    afterEach(async () => {
        await provider.shutdown();
        context.disable();
        trace.disable();
    });

    it('records generate spans with request, usage, content, and metadata attributes', async () => {
        const model: ChatModel = {
            provider: 'test',
            modelId: 'test-model',
            generate: vi.fn(async () => createGenerateResult('Hello')),
            stream: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            generateObject: vi.fn(async () => {
                throw new Error('not implemented');
            }) as ChatModel['generateObject'],
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }) as ChatModel['streamObject'],
        };
        const wrappedModel = wrapChatModel({
            model,
            middleware: createOtelMiddleware(),
        });

        await generate({
            model: wrappedModel,
            messages: [{ role: 'user', content: 'Hi' }],
            temperature: 0.3,
            metadata: {
                functionId: 'generate-test',
                team: 'ai',
            },
        });

        const span = expectDefined(exporter.getFinishedSpans()[0]);
        expect(span.name).toBe('chat test-model');
        expect(span.kind).toBe(SpanKind.CLIENT);
        expect(span.status.code).toBe(SpanStatusCode.OK);
        expect(span.attributes['gen_ai.provider.name']).toBe('test');
        expect(span.attributes['gen_ai.request.model']).toBe('test-model');
        expect(span.attributes['gen_ai.operation.name']).toBe('chat');
        expect(span.attributes['gen_ai.output.type']).toBe('text');
        expect(span.attributes['gen_ai.request.temperature']).toBe(0.3);
        expect(span.attributes['gen_ai.response.finish_reasons']).toEqual(['stop']);
        expect(span.attributes['gen_ai.usage.input_tokens']).toBe(5);
        expect(span.attributes['gen_ai.usage.output_tokens']).toBe(3);
        expect(span.attributes['core_ai.function_id']).toBe('generate-test');
        expect(span.attributes['core_ai.metadata.team']).toBe('ai');
        expect(span.attributes['gen_ai.input.messages']).toBeDefined();
        expect(span.attributes['gen_ai.output.messages']).toBeDefined();
        expect(span.attributes['input.value']).toBeDefined();
        expect(span.attributes['output.value']).toBe('Hello');
    });

    it('omits content attributes when recordContent is false', async () => {
        const model: ChatModel = {
            provider: 'test',
            modelId: 'test-model',
            generate: vi.fn(async () => createGenerateResult('Hello')),
            stream: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            generateObject: vi.fn(async () => {
                throw new Error('not implemented');
            }) as ChatModel['generateObject'],
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }) as ChatModel['streamObject'],
        };
        const wrappedModel = wrapChatModel({
            model,
            middleware: createOtelMiddleware({
                recordContent: false,
            }),
        });

        await generate({
            model: wrappedModel,
            messages: [{ role: 'user', content: 'Hi' }],
        });

        const span = expectDefined(exporter.getFinishedSpans()[0]);
        expect(span.attributes['gen_ai.input.messages']).toBeUndefined();
        expect(span.attributes['gen_ai.output.messages']).toBeUndefined();
        expect(span.attributes['input.value']).toBeUndefined();
        expect(span.attributes['output.value']).toBeUndefined();
    });

    it('records object output for generateObject', async () => {
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
            generateObject: vi.fn(async () => ({
                object: { answer: '42' },
                finishReason: 'stop',
                usage: createChatUsage(),
            })) as ChatModel['generateObject'],
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }) as ChatModel['streamObject'],
        };
        const wrappedModel = wrapChatModel({
            model,
            middleware: createOtelMiddleware(),
        });

        await generateObject({
            model: wrappedModel,
            messages: [{ role: 'user', content: 'answer with json' }],
            schema,
            schemaName: 'Answer',
        });

        const span = expectDefined(exporter.getFinishedSpans()[0]);
        expect(span.attributes['gen_ai.output.type']).toBe('json');
        expect(span.attributes['gen_ai.request.schema_name']).toBe('Answer');
        expect(span.attributes['output.value']).toBe(JSON.stringify({ answer: '42' }));
    });

    it('keeps stream spans open until the stream result resolves', async () => {
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
            }) as ChatModel['generateObject'],
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }) as ChatModel['streamObject'],
        };
        const wrappedModel = wrapChatModel({
            model,
            middleware: createOtelMiddleware(),
        });

        const chatStream = await stream({
            model: wrappedModel,
            messages: [{ role: 'user', content: 'Hi' }],
        });

        expect(exporter.getFinishedSpans()).toHaveLength(0);

        deferred.resolve({
            ...createGenerateResult('Hello'),
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

        const span = expectDefined(exporter.getFinishedSpans()[0]);
        expect(span.attributes['gen_ai.usage.input_tokens']).toBe(3);
        expect(span.attributes['gen_ai.usage.output_tokens']).toBe(2);
        expect(span.attributes['gen_ai.output.messages']).toBeDefined();
    });

    it('records stream errors on the span', async () => {
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
            }) as ChatModel['generateObject'],
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }) as ChatModel['streamObject'],
        };
        const wrappedModel = wrapChatModel({
            model,
            middleware: createOtelMiddleware(),
        });

        const chatStream = await stream({
            model: wrappedModel,
            messages: [{ role: 'user', content: 'Hi' }],
        });

        deferred.reject(new Error('stream failed'));

        await expect(chatStream.result).rejects.toThrow('stream failed');
        await Promise.resolve();

        const span = expectDefined(exporter.getFinishedSpans()[0]);
        expect(span.status.code).toBe(SpanStatusCode.ERROR);
        expect(span.status.message).toBe('stream failed');
        expect(span.attributes['error.type']).toBe('Error');
    });

    it('parents child spans created during generate execution', async () => {
        const model: ChatModel = {
            provider: 'test',
            modelId: 'test-model',
            generate: vi.fn(async () => {
                const child = trace.getTracer('test').startSpan('child');
                child.end();

                return createGenerateResult('Hello');
            }),
            stream: vi.fn(async () => {
                throw new Error('not implemented');
            }),
            generateObject: vi.fn(async () => {
                throw new Error('not implemented');
            }) as ChatModel['generateObject'],
            streamObject: vi.fn(async () => {
                throw new Error('not implemented');
            }) as ChatModel['streamObject'],
        };
        const wrappedModel = wrapChatModel({
            model,
            middleware: createOtelMiddleware(),
        });

        await generate({
            model: wrappedModel,
            messages: [{ role: 'user', content: 'Hi' }],
        });

        const spans = exporter.getFinishedSpans();
        const parentSpan = spans.find((span) => span.name === 'chat test-model');
        const childSpan = spans.find((span) => span.name === 'child');

        expect(parentSpan).toBeDefined();
        expect(childSpan).toBeDefined();
        expect(childSpan?.spanContext().traceId).toBe(parentSpan?.spanContext().traceId);
        expect(childSpan?.parentSpanContext?.spanId).toBe(
            parentSpan?.spanContext().spanId
        );
    });

    it('records embedding input and usage', async () => {
        const model: EmbeddingModel = {
            provider: 'test',
            modelId: 'embed-model',
            embed: vi.fn(async () => ({
                embeddings: [[0.1, 0.2]],
                usage: {
                    inputTokens: 3,
                },
            })),
        };
        const wrappedModel = wrapEmbeddingModel({
            model,
            middleware: createOtelEmbeddingMiddleware(),
        });

        await embed({
            model: wrappedModel,
            input: ['hello', 'world'],
        });

        const span = expectDefined(exporter.getFinishedSpans()[0]);
        expect(span.name).toBe('embeddings embed-model');
        expect(span.attributes['gen_ai.usage.input_tokens']).toBe(3);
        expect(span.attributes['input.value']).toBe(JSON.stringify(['hello', 'world']));
    });

    it('records image prompts', async () => {
        const model: ImageModel = {
            provider: 'test',
            modelId: 'image-model',
            generate: vi.fn(async () => ({
                images: [{ base64: 'abc' }],
            })),
        };
        const wrappedModel = wrapImageModel({
            model,
            middleware: createOtelImageMiddleware(),
        });

        await generateImage({
            model: wrappedModel,
            prompt: 'a cat',
        });

        const span = expectDefined(exporter.getFinishedSpans()[0]);
        expect(span.name).toBe('image_generation image-model');
        expect(span.attributes['gen_ai.output.type']).toBe('image');
        expect(span.attributes['input.value']).toBe('a cat');
    });
});
