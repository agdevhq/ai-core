import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import type { z } from 'zod';
import type {
    AssistantContentPart,
    ChatModel,
    ChatModelMiddleware,
    ChatUsage,
    EmbedOptions,
    EmbeddingModel,
    EmbeddingModelMiddleware,
    EmbeddingUsage,
    FinishReason,
    GenerateObjectOptions,
    GenerateObjectResult,
    GenerateOptions,
    GenerateResult,
    ImageGenerateOptions,
    ImageModel,
    ImageModelMiddleware,
    Message,
    ObjectStream,
    StreamObjectOptions,
    ToolSet,
    UserContentPart,
} from '@core-ai/core-ai';
import { zodSchemaToJsonSchema } from '@core-ai/core-ai';

type SpanAttributeValue =
    | string
    | number
    | boolean
    | string[]
    | number[]
    | boolean[];

export type OtelMiddlewareOptions = {
    recordContent?: boolean;
    tracerName?: string;
};

function safeJsonStringify(value: unknown): string | undefined {
    try {
        return JSON.stringify(value);
    } catch {
        return undefined;
    }
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

function toError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }

    return new Error(String(error));
}

function setSpanAttribute(
    span: Span,
    key: string,
    value: SpanAttributeValue | undefined
): void {
    if (value !== undefined) {
        span.setAttribute(key, value);
    }
}

function isPrimitiveArray(
    value: unknown
): value is string[] | number[] | boolean[] {
    if (!Array.isArray(value)) {
        return false;
    }

    if (value.length === 0) {
        return true;
    }

    const first = value[0];
    const primitiveType = typeof first;

    if (
        primitiveType !== 'string' &&
        primitiveType !== 'number' &&
        primitiveType !== 'boolean'
    ) {
        return false;
    }

    return value.every((item) => typeof item === primitiveType);
}

function toSpanAttributeValue(value: unknown): SpanAttributeValue | undefined {
    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    if (isPrimitiveArray(value)) {
        return value;
    }

    return safeJsonStringify(value);
}

function setMetadataAttributes(
    span: Span,
    metadata: Record<string, unknown> | undefined
): void {
    if (!metadata) {
        return;
    }

    const { functionId, ...restMetadata } = metadata;

    if (typeof functionId === 'string') {
        span.setAttribute('core_ai.function_id', functionId);
    }

    for (const [key, value] of Object.entries(restMetadata)) {
        setSpanAttribute(
            span,
            `core_ai.metadata.${key}`,
            toSpanAttributeValue(value)
        );
    }
}

function serializeUserContentParts(
    content: string | UserContentPart[]
): Record<string, unknown>[] {
    if (typeof content === 'string') {
        return [{ type: 'text', content }];
    }

    return content.map((part) => {
        if (part.type === 'text') {
            return {
                type: 'text',
                content: part.text,
            };
        }

        if (part.type === 'image') {
            return {
                type: 'image',
                source: part.source,
            };
        }

        return {
            type: 'file',
            data: part.data,
            mime_type: part.mimeType,
            ...(part.filename ? { filename: part.filename } : {}),
        };
    });
}

function serializeAssistantContentParts(
    parts: AssistantContentPart[]
): Record<string, unknown>[] {
    return parts.map((part) => {
        if (part.type === 'text') {
            return {
                type: 'text',
                content: part.text,
            };
        }

        if (part.type === 'reasoning') {
            return {
                type: 'reasoning',
                content: part.text,
                ...(part.providerMetadata
                    ? {
                          provider_metadata: part.providerMetadata,
                      }
                    : {}),
            };
        }

        return {
            type: 'tool_call',
            id: part.toolCall.id,
            name: part.toolCall.name,
            arguments: part.toolCall.arguments,
        };
    });
}

function setChatInputAttributes(
    span: Span,
    messages: Message[],
    tools?: ToolSet
): void {
    const systemInstructions: Array<{ type: 'text'; content: string }> = [];
    const inputMessages: Array<Record<string, unknown>> = [];

    for (const message of messages) {
        if (message.role === 'system') {
            systemInstructions.push({
                type: 'text',
                content: message.content,
            });
            continue;
        }

        if (message.role === 'user') {
            inputMessages.push({
                role: 'user',
                parts: serializeUserContentParts(message.content),
            });
            continue;
        }

        if (message.role === 'assistant') {
            inputMessages.push({
                role: 'assistant',
                parts: serializeAssistantContentParts(message.parts),
            });
            continue;
        }

        inputMessages.push({
            role: 'tool',
            parts: [
                {
                    type: 'tool_call_response',
                    id: message.toolCallId,
                    result: message.content,
                    ...(message.isError ? { is_error: true } : {}),
                },
            ],
        });
    }

    if (systemInstructions.length > 0) {
        setSpanAttribute(
            span,
            'gen_ai.system_instructions',
            safeJsonStringify(systemInstructions)
        );
    }

    setSpanAttribute(
        span,
        'gen_ai.input.messages',
        safeJsonStringify(inputMessages)
    );
    setSpanAttribute(span, 'input.value', safeJsonStringify(messages));

    if (tools && Object.keys(tools).length > 0) {
        setSpanAttribute(
            span,
            'gen_ai.tool.definitions',
            safeJsonStringify(
                Object.entries(tools).map(([name, definition]) => ({
                    type: 'function',
                    name,
                    description: definition.description,
                    parameters: zodSchemaToJsonSchema(definition.parameters),
                }))
            )
        );
    }
}

function setChatOutputAttributes(span: Span, result: GenerateResult): void {
    const parts = serializeAssistantContentParts(result.parts);

    setSpanAttribute(
        span,
        'gen_ai.output.messages',
        safeJsonStringify([
            {
                role: 'assistant',
                parts,
                finish_reason: result.finishReason,
            },
        ])
    );

    const outputValue =
        result.content ?? (parts.length > 0 ? safeJsonStringify(parts) : undefined);

    setSpanAttribute(
        span,
        'output.value',
        outputValue === null ? undefined : outputValue
    );
}

function setObjectOutputAttributes<TSchema extends z.ZodType>(
    span: Span,
    result: GenerateObjectResult<TSchema>
): void {
    const objectContent =
        result.object === undefined ? 'undefined' : safeJsonStringify(result.object);

    if (!objectContent) {
        return;
    }

    setSpanAttribute(
        span,
        'gen_ai.output.messages',
        safeJsonStringify([
            {
                role: 'assistant',
                parts: [
                    {
                        type: 'text',
                        content: objectContent,
                    },
                ],
                finish_reason: result.finishReason,
            },
        ])
    );
    span.setAttribute('output.value', objectContent);
}

function setEmbedInputAttributes(span: Span, input: string | string[]): void {
    span.setAttribute(
        'input.value',
        typeof input === 'string' ? input : JSON.stringify(input)
    );
}

function setImageInputAttributes(span: Span, prompt: string): void {
    span.setAttribute('input.value', prompt);
}

function setChatUsageAttributes(span: Span, usage: ChatUsage): void {
    span.setAttribute('gen_ai.usage.input_tokens', usage.inputTokens);
    span.setAttribute('gen_ai.usage.output_tokens', usage.outputTokens);
    span.setAttribute(
        'gen_ai.usage.cache_read.input_tokens',
        usage.inputTokenDetails.cacheReadTokens
    );
    span.setAttribute(
        'gen_ai.usage.cache_creation.input_tokens',
        usage.inputTokenDetails.cacheWriteTokens
    );
}

function setEmbedUsageAttributes(
    span: Span,
    usage: EmbeddingUsage | undefined
): void {
    if (!usage) {
        return;
    }

    span.setAttribute('gen_ai.usage.input_tokens', usage.inputTokens);
}

function setFinishReasonAttribute(span: Span, finishReason: FinishReason): void {
    span.setAttribute('gen_ai.response.finish_reasons', [finishReason]);
}

function recordError(span: Span, error: unknown): void {
    span.setAttribute('error.type', error instanceof Error ? error.name : '_OTHER');
    span.setStatus({
        code: SpanStatusCode.ERROR,
        message: getErrorMessage(error),
    });
    span.recordException(toError(error));
}

function setChatRequestAttributes(
    span: Span,
    model: ChatModel,
    options: GenerateOptions | GenerateObjectOptions<z.ZodType>,
    outputType: 'text' | 'json'
): void {
    span.setAttribute('gen_ai.provider.name', model.provider);
    span.setAttribute('gen_ai.request.model', model.modelId);
    span.setAttribute('gen_ai.operation.name', 'chat');
    span.setAttribute('gen_ai.output.type', outputType);
    setSpanAttribute(
        span,
        'gen_ai.request.temperature',
        options.temperature
    );
    setSpanAttribute(span, 'gen_ai.request.max_tokens', options.maxTokens);
    setSpanAttribute(span, 'gen_ai.request.top_p', options.topP);

    if ('schemaName' in options) {
        setSpanAttribute(
            span,
            'gen_ai.request.schema_name',
            options.schemaName
        );
    }

    setMetadataAttributes(span, options.metadata);
}

function setEmbedRequestAttributes(
    span: Span,
    model: EmbeddingModel,
    options: EmbedOptions
): void {
    span.setAttribute('gen_ai.provider.name', model.provider);
    span.setAttribute('gen_ai.request.model', model.modelId);
    span.setAttribute('gen_ai.operation.name', 'embeddings');
    setMetadataAttributes(span, options.metadata);
}

function setImageRequestAttributes(
    span: Span,
    model: ImageModel,
    options: ImageGenerateOptions
): void {
    span.setAttribute('gen_ai.provider.name', model.provider);
    span.setAttribute('gen_ai.request.model', model.modelId);
    span.setAttribute('gen_ai.operation.name', 'image_generation');
    span.setAttribute('gen_ai.output.type', 'image');
    setMetadataAttributes(span, options.metadata);
}

function createChatSpanName(model: ChatModel): string {
    return `chat ${model.modelId}`;
}

function createEmbedSpanName(model: EmbeddingModel): string {
    return `embeddings ${model.modelId}`;
}

function createImageSpanName(model: ImageModel): string {
    return `image_generation ${model.modelId}`;
}

export function createOtelMiddleware(
    options: OtelMiddlewareOptions = {}
): ChatModelMiddleware {
    const { recordContent = true, tracerName = 'core-ai' } = options;

    return {
        generate: async ({ execute, options: generateOptions, model }) => {
            const tracer = trace.getTracer(tracerName);

            return tracer.startActiveSpan(
                createChatSpanName(model),
                {
                    kind: SpanKind.CLIENT,
                },
                async (span) => {
                    setChatRequestAttributes(span, model, generateOptions, 'text');

                    if (recordContent) {
                        setChatInputAttributes(
                            span,
                            generateOptions.messages,
                            generateOptions.tools
                        );
                    }

                    try {
                        const result = await execute();
                        setChatUsageAttributes(span, result.usage);
                        setFinishReasonAttribute(span, result.finishReason);

                        if (recordContent) {
                            setChatOutputAttributes(span, result);
                        }

                        span.setStatus({
                            code: SpanStatusCode.OK,
                        });
                        return result;
                    } catch (error) {
                        recordError(span, error);
                        throw error;
                    } finally {
                        span.end();
                    }
                }
            );
        },
        stream: async ({ execute, options: generateOptions, model }) => {
            const tracer = trace.getTracer(tracerName);

            return tracer.startActiveSpan(
                createChatSpanName(model),
                {
                    kind: SpanKind.CLIENT,
                },
                async (span) => {
                    setChatRequestAttributes(span, model, generateOptions, 'text');

                    if (recordContent) {
                        setChatInputAttributes(
                            span,
                            generateOptions.messages,
                            generateOptions.tools
                        );
                    }

                    try {
                        const chatStream = await execute();

                        void chatStream.result
                            .then((result) => {
                                setChatUsageAttributes(span, result.usage);
                                setFinishReasonAttribute(span, result.finishReason);

                                if (recordContent) {
                                    setChatOutputAttributes(span, result);
                                }

                                span.setStatus({
                                    code: SpanStatusCode.OK,
                                });
                            })
                            .catch((error: unknown) => {
                                recordError(span, error);
                            })
                            .finally(() => {
                                span.end();
                            });

                        return chatStream;
                    } catch (error) {
                        recordError(span, error);
                        span.end();
                        throw error;
                    }
                }
            );
        },
        generateObject: async <TSchema extends z.ZodType>(args: {
            execute: (
                options?: GenerateObjectOptions<TSchema>
            ) => Promise<GenerateObjectResult<TSchema>>;
            options: GenerateObjectOptions<TSchema>;
            model: ChatModel;
        }) => {
            const { execute, options: generateOptions, model } = args;
            const tracer = trace.getTracer(tracerName);

            return tracer.startActiveSpan(
                createChatSpanName(model),
                {
                    kind: SpanKind.CLIENT,
                },
                async (span) => {
                    setChatRequestAttributes(span, model, generateOptions, 'json');

                    if (recordContent) {
                        setChatInputAttributes(span, generateOptions.messages);
                    }

                    try {
                        const result = await execute();
                        setChatUsageAttributes(span, result.usage);
                        setFinishReasonAttribute(span, result.finishReason);

                        if (recordContent) {
                            setObjectOutputAttributes(span, result);
                        }

                        span.setStatus({
                            code: SpanStatusCode.OK,
                        });
                        return result;
                    } catch (error) {
                        recordError(span, error);
                        throw error;
                    } finally {
                        span.end();
                    }
                }
            );
        },
        streamObject: async <TSchema extends z.ZodType>(args: {
            execute: (
                options?: StreamObjectOptions<TSchema>
            ) => Promise<ObjectStream<TSchema>>;
            options: StreamObjectOptions<TSchema>;
            model: ChatModel;
        }) => {
            const { execute, options: generateOptions, model } = args;
            const tracer = trace.getTracer(tracerName);

            return tracer.startActiveSpan(
                createChatSpanName(model),
                {
                    kind: SpanKind.CLIENT,
                },
                async (span) => {
                    setChatRequestAttributes(span, model, generateOptions, 'json');

                    if (recordContent) {
                        setChatInputAttributes(span, generateOptions.messages);
                    }

                    try {
                        const objectStream = await execute();

                        void objectStream.result
                            .then((result) => {
                                setChatUsageAttributes(span, result.usage);
                                setFinishReasonAttribute(span, result.finishReason);

                                if (recordContent) {
                                    setObjectOutputAttributes(span, result);
                                }

                                span.setStatus({
                                    code: SpanStatusCode.OK,
                                });
                            })
                            .catch((error: unknown) => {
                                recordError(span, error);
                            })
                            .finally(() => {
                                span.end();
                            });

                        return objectStream;
                    } catch (error) {
                        recordError(span, error);
                        span.end();
                        throw error;
                    }
                }
            );
        },
    };
}

export function createOtelEmbeddingMiddleware(
    options: OtelMiddlewareOptions = {}
): EmbeddingModelMiddleware {
    const { recordContent = true, tracerName = 'core-ai' } = options;

    return {
        embed: async ({ execute, options: embedOptions, model }) => {
            const tracer = trace.getTracer(tracerName);

            return tracer.startActiveSpan(
                createEmbedSpanName(model),
                {
                    kind: SpanKind.CLIENT,
                },
                async (span) => {
                    setEmbedRequestAttributes(span, model, embedOptions);

                    if (recordContent) {
                        setEmbedInputAttributes(span, embedOptions.input);
                    }

                    try {
                        const result = await execute();
                        setEmbedUsageAttributes(span, result.usage);
                        span.setStatus({
                            code: SpanStatusCode.OK,
                        });
                        return result;
                    } catch (error) {
                        recordError(span, error);
                        throw error;
                    } finally {
                        span.end();
                    }
                }
            );
        },
    };
}

export function createOtelImageMiddleware(
    options: OtelMiddlewareOptions = {}
): ImageModelMiddleware {
    const { recordContent = true, tracerName = 'core-ai' } = options;

    return {
        generate: async ({ execute, options: imageOptions, model }) => {
            const tracer = trace.getTracer(tracerName);

            return tracer.startActiveSpan(
                createImageSpanName(model),
                {
                    kind: SpanKind.CLIENT,
                },
                async (span) => {
                    setImageRequestAttributes(span, model, imageOptions);

                    if (recordContent) {
                        setImageInputAttributes(span, imageOptions.prompt);
                    }

                    try {
                        const result = await execute();
                        span.setStatus({
                            code: SpanStatusCode.OK,
                        });
                        return result;
                    } catch (error) {
                        recordError(span, error);
                        throw error;
                    } finally {
                        span.end();
                    }
                }
            );
        },
    };
}
