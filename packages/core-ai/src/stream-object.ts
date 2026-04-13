import type { z } from 'zod';
import { assertNonEmptyMessages } from './assertions.ts';
import { CoreAIError } from './errors.ts';
import { createStream } from './base-stream.ts';
import { callModelWithOptions } from './model-options.ts';
import {
    endSpan,
    recordChatInputContent,
    recordChatUsage,
    recordFinishReason,
    recordObjectOutputContent,
    startSpan,
} from './telemetry.ts';
import type {
    ChatModel,
    GenerateObjectResult,
    ObjectStreamEvent,
    StreamObjectOptions,
    ObjectStream,
} from './types.ts';

export type StreamObjectParams<TSchema extends z.ZodType> =
    StreamObjectOptions<TSchema> & {
        model: ChatModel;
    };

export async function streamObject<TSchema extends z.ZodType>(
    params: StreamObjectParams<TSchema>
): Promise<ObjectStream<TSchema>> {
    assertNonEmptyMessages(params.messages);
    const { telemetry, ...rest } = params;
    const activeSpan = startSpan({
        name: `chat ${params.model.modelId}`,
        attributes: {
            'gen_ai.provider.name': params.model.provider,
            'gen_ai.request.model': params.model.modelId,
            'gen_ai.operation.name': 'chat',
            'gen_ai.output.type': 'json',
            'gen_ai.request.temperature': params.temperature,
            'gen_ai.request.max_tokens': params.maxTokens,
            'gen_ai.request.top_p': params.topP,
            'gen_ai.request.schema_name': params.schemaName,
        },
        telemetry,
    });
    const span = activeSpan?.span;

    try {
        if (span && telemetry?.recordContent !== false) {
            recordChatInputContent(span, params.messages);
        }

        const doCall = () =>
            callModelWithOptions(rest, (model, options) => model.streamObject(options));
        const objectStream = activeSpan
            ? await activeSpan.withContext(doCall)
            : await doCall();

        if (span) {
            void objectStream.result
                .then((result) => {
                    recordChatUsage(span, result.usage);
                    recordFinishReason(span, result.finishReason);

                    if (telemetry?.recordContent !== false) {
                        recordObjectOutputContent(span, result);
                    }

                    endSpan(span);
                })
                .catch((error: unknown) => {
                    endSpan(span, error);
                });
        }

        return objectStream;
    } catch (error) {
        if (span) {
            endSpan(span, error);
        }

        throw error;
    }
}

export function createObjectStream<TSchema extends z.ZodType>(
    source: AsyncIterable<ObjectStreamEvent<TSchema>>,
    options: {
        signal?: AbortSignal;
    } = {}
): ObjectStream<TSchema> {
    const { signal } = options;
    let objectState:
        | { status: 'pending' }
        | { status: 'ready'; object: z.infer<TSchema> } = {
        status: 'pending',
    };
    let finishReason: GenerateObjectResult<TSchema>['finishReason'] = 'unknown';
    let usage: GenerateObjectResult<TSchema>['usage'] = {
        inputTokens: 0,
        outputTokens: 0,
        inputTokenDetails: {
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
        },
        outputTokenDetails: {},
    };

    return createStream({
        source,
        signal,
        reduceEvent(event) {
            if (event.type === 'object') {
                objectState = {
                    status: 'ready',
                    object: event.object,
                };
            } else if (event.type === 'finish') {
                finishReason = event.finishReason;
                usage = event.usage;
            }
        },
        finalizeResult() {
            if (objectState.status !== 'ready') {
                throw new CoreAIError(
                    'object stream completed without emitting a final object'
                );
            }

            return {
                object: objectState.object,
                finishReason,
                usage,
            };
        },
    });
}
