import type { z } from 'zod';
import type {
    ChatStream,
    GenerateResult,
    ObjectStreamEvent,
} from '@core-ai/core-ai';
import {
    StructuredOutputNoObjectGeneratedError,
    StructuredOutputParseError,
    StructuredOutputValidationError,
} from '@core-ai/core-ai';

export function extractStructuredObject<TSchema extends z.ZodType>(
    result: GenerateResult,
    schema: TSchema,
    provider: string,
    toolName: string
): z.infer<TSchema> {
    const structuredToolCall = result.toolCalls.find(
        (toolCall) => toolCall.name === toolName
    );
    if (structuredToolCall) {
        return validateStructuredToolArguments(
            schema,
            structuredToolCall.arguments,
            provider
        );
    }

    const rawOutput = result.content?.trim();
    if (rawOutput && rawOutput.length > 0) {
        return parseAndValidateStructuredPayload(schema, rawOutput, provider);
    }

    throw new StructuredOutputNoObjectGeneratedError(
        'model did not emit a structured object payload',
        provider
    );
}

export async function* transformStructuredOutputStream<TSchema extends z.ZodType>(
    stream: ChatStream,
    schema: TSchema,
    provider: string,
    toolName: string
): AsyncIterable<ObjectStreamEvent<TSchema>> {
    let validatedObject: z.infer<TSchema> | undefined;
    let contentBuffer = '';
    const toolArgumentDeltas = new Map<string, string>();

    for await (const event of stream) {
        if (event.type === 'text-delta') {
            contentBuffer += event.text;
            yield {
                type: 'object-delta',
                text: event.text,
            };
            continue;
        }

        if (event.type === 'tool-call-delta') {
            const previous = toolArgumentDeltas.get(event.toolCallId) ?? '';
            toolArgumentDeltas.set(
                event.toolCallId,
                `${previous}${event.argumentsDelta}`
            );

            yield {
                type: 'object-delta',
                text: event.argumentsDelta,
            };
            continue;
        }

        if (
            event.type === 'tool-call-end' &&
            event.toolCall.name === toolName
        ) {
            validatedObject = validateStructuredToolArguments(
                schema,
                event.toolCall.arguments,
                provider
            );
            yield {
                type: 'object',
                object: validatedObject,
            };
            continue;
        }

        if (event.type === 'finish') {
            if (validatedObject === undefined) {
                const fallbackPayload = getFallbackStructuredPayload(
                    contentBuffer,
                    toolArgumentDeltas
                );

                if (!fallbackPayload) {
                    throw new StructuredOutputNoObjectGeneratedError(
                        'structured output stream ended without an object payload',
                        provider
                    );
                }

                validatedObject = parseAndValidateStructuredPayload(
                    schema,
                    fallbackPayload,
                    provider
                );
                yield {
                    type: 'object',
                    object: validatedObject,
                };
            }

            yield {
                type: 'finish',
                finishReason: event.finishReason,
                usage: event.usage,
            };
        }
    }
}

function getFallbackStructuredPayload(
    contentBuffer: string,
    toolArgumentDeltas: Map<string, string>
): string | undefined {
    for (const delta of toolArgumentDeltas.values()) {
        const trimmed = delta.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }

    const trimmedContent = contentBuffer.trim();
    if (trimmedContent.length > 0) {
        return trimmedContent;
    }

    return undefined;
}

function validateStructuredToolArguments<TSchema extends z.ZodType>(
    schema: TSchema,
    toolArguments: Record<string, unknown>,
    provider: string
): z.infer<TSchema> {
    return validateStructuredObject(
        schema,
        toolArguments,
        provider,
        JSON.stringify(toolArguments)
    );
}

function parseAndValidateStructuredPayload<TSchema extends z.ZodType>(
    schema: TSchema,
    rawPayload: string,
    provider: string
): z.infer<TSchema> {
    const parsedPayload = parseJson(rawPayload, provider);
    return validateStructuredObject(
        schema,
        parsedPayload,
        provider,
        rawPayload
    );
}

function parseJson(rawOutput: string, provider: string): unknown {
    try {
        return JSON.parse(rawOutput);
    } catch (error) {
        throw new StructuredOutputParseError(
            'failed to parse structured output as JSON',
            provider,
            {
                rawOutput,
                cause: error,
            }
        );
    }
}

function validateStructuredObject<TSchema extends z.ZodType>(
    schema: TSchema,
    value: unknown,
    provider: string,
    rawOutput?: string
): z.infer<TSchema> {
    const parsed = schema.safeParse(value);
    if (parsed.success) {
        return parsed.data;
    }

    throw new StructuredOutputValidationError(
        'structured output does not match schema',
        provider,
        formatZodIssues(parsed.error.issues),
        {
            rawOutput,
        }
    );
}

function formatZodIssues(issues: z.ZodIssue[]): string[] {
    return issues.map((issue) => {
        const path =
            issue.path.length > 0
                ? issue.path.map((segment) => String(segment)).join('.')
                : '<root>';
        return `${path}: ${issue.message}`;
    });
}
