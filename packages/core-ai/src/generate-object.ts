import type { z } from 'zod';
import { assertNonEmptyMessages } from './assertions.ts';
import { callModelWithOptions } from './model-options.ts';
import {
    recordChatInputContent,
    recordChatUsage,
    recordFinishReason,
    recordObjectOutputContent,
    withSpan,
} from './telemetry.ts';
import type {
    ChatModel,
    GenerateObjectOptions,
    GenerateObjectResult,
} from './types.ts';

export type GenerateObjectParams<TSchema extends z.ZodType> =
    GenerateObjectOptions<TSchema> & {
        model: ChatModel;
    };

export async function generateObject<TSchema extends z.ZodType>(
    params: GenerateObjectParams<TSchema>
): Promise<GenerateObjectResult<TSchema>> {
    assertNonEmptyMessages(params.messages);
    const { telemetry, ...rest } = params;

    return withSpan(
        {
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
        },
        async (span) => {
            if (span && telemetry?.recordContent !== false) {
                recordChatInputContent(span, params.messages);
            }

            const result = await callModelWithOptions(rest, (model, options) =>
                model.generateObject(options)
            );

            if (span) {
                recordChatUsage(span, result.usage);
                recordFinishReason(span, result.finishReason);

                if (telemetry?.recordContent !== false) {
                    recordObjectOutputContent(span, result);
                }
            }

            return result;
        }
    );
}
