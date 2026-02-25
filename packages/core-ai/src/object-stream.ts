import type { z } from 'zod';
import {
    extractStructuredValue,
    safeStringify,
    tryParseJsonText,
    type StructuredStrategy,
    validateStructuredValue,
} from './structured-output.ts';
import type {
    DeepPartial,
    GenerateObjectResult,
    ObjectStreamEvent,
    ObjectStreamResult,
    StreamResult,
} from './types.ts';

type CreateObjectStreamResultParams<TSchema extends z.ZodTypeAny> = {
    source: StreamResult;
    schema: TSchema;
    strategy: StructuredStrategy;
    schemaToolName: string;
    provider: string;
    modelId: string;
};

export function createObjectStreamResult<TSchema extends z.ZodTypeAny>(
    params: CreateObjectStreamResultParams<TSchema>
): ObjectStreamResult<TSchema> {
    let resolveResponse:
        | ((result: GenerateObjectResult<TSchema>) => void)
        | undefined;
    let rejectResponse: ((error: unknown) => void) | undefined;
    const responsePromise = new Promise<GenerateObjectResult<TSchema>>(
        (resolve, reject) => {
            resolveResponse = resolve;
            rejectResponse = reject;
        }
    );

    let iteratorCreated = false;

    async function* iterate(): AsyncGenerator<ObjectStreamEvent<TSchema>> {
        const structuredToolCallIds = new Set<string>();
        let jsonBuffer = '';
        let lastPartialSerialized: string | undefined;
        let finalToolValue: unknown | undefined;

        const emitObjectDelta = (
            value: unknown
        ): ObjectStreamEvent<TSchema> | undefined => {
            const serialized = safeStringify(value);
            if (!serialized || serialized === lastPartialSerialized) {
                return undefined;
            }
            lastPartialSerialized = serialized;
            return {
                type: 'object-delta',
                partial: value as DeepPartial<z.infer<TSchema>>,
            };
        };

        try {
            for await (const event of params.source) {
                if (params.strategy === 'tool') {
                    if (
                        event.type === 'tool-call-start' &&
                        event.toolName === params.schemaToolName
                    ) {
                        structuredToolCallIds.add(event.toolCallId);
                    }

                    if (
                        event.type === 'tool-call-delta' &&
                        structuredToolCallIds.has(event.toolCallId)
                    ) {
                        jsonBuffer += event.argumentsDelta;
                        yield {
                            type: 'json-delta',
                            text: event.argumentsDelta,
                        };

                        const parsed = tryParseJsonText(jsonBuffer);
                        if (parsed !== undefined) {
                            const objectDelta = emitObjectDelta(parsed);
                            if (objectDelta) {
                                yield objectDelta;
                            }
                        }
                    }

                    if (
                        event.type === 'tool-call-end' &&
                        (structuredToolCallIds.has(event.toolCall.id) ||
                            event.toolCall.name === params.schemaToolName)
                    ) {
                        finalToolValue = event.toolCall.arguments;
                        structuredToolCallIds.add(event.toolCall.id);

                        if (jsonBuffer.length === 0) {
                            const serializedArguments = safeStringify(
                                event.toolCall.arguments
                            );
                            if (serializedArguments) {
                                jsonBuffer = serializedArguments;
                                yield {
                                    type: 'json-delta',
                                    text: serializedArguments,
                                };
                            }
                        }

                        const objectDelta = emitObjectDelta(event.toolCall.arguments);
                        if (objectDelta) {
                            yield objectDelta;
                        }
                    }
                } else if (event.type === 'content-delta') {
                    jsonBuffer += event.text;
                    yield {
                        type: 'json-delta',
                        text: event.text,
                    };

                    const parsed = tryParseJsonText(jsonBuffer);
                    if (parsed !== undefined) {
                        const objectDelta = emitObjectDelta(parsed);
                        if (objectDelta) {
                            yield objectDelta;
                        }
                    }
                }

                if (event.type === 'finish') {
                    yield {
                        type: 'finish',
                        finishReason: event.finishReason,
                        usage: event.usage,
                    };
                }
            }

            const raw = await params.source.toResponse();
            const extracted =
                finalToolValue !== undefined
                    ? {
                          value: finalToolValue,
                          rawText:
                              safeStringify(finalToolValue) ??
                              (jsonBuffer.length > 0 ? jsonBuffer : undefined),
                      }
                    : extractStructuredValue({
                          result: raw,
                          strategy: params.strategy,
                          schemaToolName: params.schemaToolName,
                          provider: params.provider,
                          modelId: params.modelId,
                      });

            const object = validateStructuredValue({
                schema: params.schema,
                value: extracted.value,
                rawText: extracted.rawText,
                provider: params.provider,
                modelId: params.modelId,
            });

            resolveResponse?.({
                object,
                finishReason: raw.finishReason,
                usage: raw.usage,
                raw,
            });
        } catch (error) {
            rejectResponse?.(error);
            throw error;
        }
    }

    const generator = iterate();

    return {
        [Symbol.asyncIterator]() {
            if (iteratorCreated) {
                throw new Error('Stream can only be iterated once');
            }
            iteratorCreated = true;
            return generator;
        },
        toResponse() {
            if (!iteratorCreated) {
                iteratorCreated = true;
                (async () => {
                    try {
                        for await (const _event of generator) {
                            // Consume the stream to build the final structured response.
                        }
                    } catch {
                        // Rejection is handled by responsePromise.
                    }
                })();
            }
            return responsePromise;
        },
    };
}
