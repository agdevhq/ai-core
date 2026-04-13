import { createRequire } from 'node:module';
import type { Span } from '@opentelemetry/api';
import type { z } from 'zod';
import { zodSchemaToJsonSchema } from './json-schema.ts';
import type {
    AssistantContentPart,
    ChatUsage,
    EmbeddingUsage,
    FinishReason,
    GenerateObjectResult,
    GenerateResult,
    Message,
    TelemetryConfig,
    ToolSet,
    UserContentPart,
} from './types.ts';

const require = createRequire(import.meta.url);
const TRACER_NAME = 'core-ai';

type OTelApi = typeof import('@opentelemetry/api');
type SpanConfig = {
    name: string;
    attributes: Record<string, string | number | boolean | undefined>;
    telemetry?: TelemetryConfig;
};

let cachedOtel: OTelApi | null = null;
let hasAttemptedOtelLoad = false;

function getOTel(): OTelApi | undefined {
    if (hasAttemptedOtelLoad) {
        return cachedOtel ?? undefined;
    }

    hasAttemptedOtelLoad = true;

    try {
        cachedOtel = require('@opentelemetry/api') as OTelApi;
    } catch {
        cachedOtel = null;
    }

    return cachedOtel ?? undefined;
}

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

function setSpanAttributes(span: Span, config: SpanConfig): void {
    for (const [key, value] of Object.entries(config.attributes)) {
        if (value !== undefined) {
            span.setAttribute(key, value);
        }
    }

    if (config.telemetry?.functionId) {
        span.setAttribute('core_ai.function_id', config.telemetry.functionId);
    }

    if (config.telemetry?.metadata) {
        for (const [key, value] of Object.entries(config.telemetry.metadata)) {
            span.setAttribute(`core_ai.metadata.${key}`, value);
        }
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

export function withSpan<T>(
    config: SpanConfig,
    fn: (span: Span | undefined) => Promise<T>
): Promise<T> {
    if (!config.telemetry?.isEnabled) {
        return fn(undefined);
    }

    const otel = getOTel();
    const tracer = otel?.trace.getTracer(TRACER_NAME);

    if (!otel || !tracer) {
        return fn(undefined);
    }

    return tracer.startActiveSpan(
        config.name,
        {
            kind: otel.SpanKind.CLIENT,
        },
        async (span) => {
            try {
                setSpanAttributes(span, config);
                const result = await fn(span);
                span.setStatus({
                    code: otel.SpanStatusCode.OK,
                });
                return result;
            } catch (error) {
                span.setAttribute(
                    'error.type',
                    error instanceof Error ? error.name : '_OTHER'
                );
                span.setStatus({
                    code: otel.SpanStatusCode.ERROR,
                    message: getErrorMessage(error),
                });
                span.recordException(toError(error));
                throw error;
            } finally {
                span.end();
            }
        }
    );
}

export type ActiveSpan = {
    span: Span;
    withContext: <T>(fn: () => T) => T;
};

export function startSpan(config: SpanConfig): ActiveSpan | undefined {
    if (!config.telemetry?.isEnabled) {
        return undefined;
    }

    const otel = getOTel();
    const tracer = otel?.trace.getTracer(TRACER_NAME);

    if (!otel || !tracer) {
        return undefined;
    }

    const span = tracer.startSpan(config.name, {
        kind: otel.SpanKind.CLIENT,
    });
    setSpanAttributes(span, config);

    const ctx = otel.trace.setSpan(otel.context.active(), span);

    return {
        span,
        withContext: <T>(fn: () => T): T => otel.context.with(ctx, fn),
    };
}

export function endSpan(span: Span, error?: unknown): void {
    const otel = getOTel();

    if (!otel) {
        return;
    }

    if (error !== undefined) {
        span.setAttribute('error.type', error instanceof Error ? error.name : '_OTHER');
        span.setStatus({
            code: otel.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
        });
        span.recordException(toError(error));
    } else {
        span.setStatus({
            code: otel.SpanStatusCode.OK,
        });
    }

    span.end();
}

export function recordChatInputContent(
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
        const serialized = safeJsonStringify(systemInstructions);
        if (serialized) {
            span.setAttribute('gen_ai.system_instructions', serialized);
        }
    }

    const inputMessagesSerialized = safeJsonStringify(inputMessages);
    if (inputMessagesSerialized) {
        span.setAttribute('gen_ai.input.messages', inputMessagesSerialized);
    }

    const inputValueSerialized = safeJsonStringify(messages);
    if (inputValueSerialized) {
        span.setAttribute('input.value', inputValueSerialized);
    }

    if (tools && Object.keys(tools).length > 0) {
        const toolsSerialized = safeJsonStringify(
            Object.entries(tools).map(([name, definition]) => ({
                type: 'function',
                name,
                description: definition.description,
                parameters: zodSchemaToJsonSchema(definition.parameters),
            }))
        );
        if (toolsSerialized) {
            span.setAttribute('gen_ai.tool.definitions', toolsSerialized);
        }
    }
}

export function recordChatOutputContent(
    span: Span,
    result: GenerateResult
): void {
    const parts = serializeAssistantContentParts(result.parts);

    span.setAttribute(
        'gen_ai.output.messages',
        JSON.stringify([
            {
                role: 'assistant',
                parts,
                finish_reason: result.finishReason,
            },
        ])
    );

    const outputValue =
        result.content ?? (parts.length > 0 ? JSON.stringify(parts) : null);

    if (outputValue !== null) {
        span.setAttribute('output.value', outputValue);
    }
}

export function recordObjectOutputContent<TSchema extends z.ZodType>(
    span: Span,
    result: GenerateObjectResult<TSchema>
): void {
    const objectContent =
        result.object === undefined ? 'undefined' : safeJsonStringify(result.object);

    if (!objectContent) {
        return;
    }

    span.setAttribute(
        'gen_ai.output.messages',
        JSON.stringify([
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

export function recordEmbedInputContent(
    span: Span,
    input: string | string[]
): void {
    span.setAttribute(
        'input.value',
        typeof input === 'string' ? input : JSON.stringify(input)
    );
}

export function recordImageInputContent(span: Span, prompt: string): void {
    span.setAttribute('input.value', prompt);
}

export function recordChatUsage(
    span: Span,
    usage: ChatUsage
): void {
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

export function recordEmbedUsage(
    span: Span,
    usage: EmbeddingUsage | undefined
): void {
    if (!usage) {
        return;
    }

    span.setAttribute('gen_ai.usage.input_tokens', usage.inputTokens);
}

export function recordFinishReason(
    span: Span,
    finishReason: FinishReason
): void {
    span.setAttribute('gen_ai.response.finish_reasons', [finishReason]);
}
