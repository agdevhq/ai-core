import { assertNonEmptyMessages } from './assertions.ts';
import { callModelWithOptions } from './model-options.ts';
import {
    recordChatInputContent,
    recordChatOutputContent,
    recordChatUsage,
    recordFinishReason,
    withSpan,
} from './telemetry.ts';
import type { ChatModel, GenerateOptions, GenerateResult } from './types.ts';

export type GenerateParams = GenerateOptions & {
    model: ChatModel;
};

export async function generate(
    params: GenerateParams
): Promise<GenerateResult> {
    assertNonEmptyMessages(params.messages);
    const { telemetry, ...rest } = params;

    return withSpan(
        {
            name: `chat ${params.model.modelId}`,
            attributes: {
                'gen_ai.provider.name': params.model.provider,
                'gen_ai.request.model': params.model.modelId,
                'gen_ai.operation.name': 'chat',
                'gen_ai.output.type': 'text',
                'gen_ai.request.temperature': params.temperature,
                'gen_ai.request.max_tokens': params.maxTokens,
                'gen_ai.request.top_p': params.topP,
            },
            telemetry,
        },
        async (span) => {
            if (span && telemetry?.recordContent !== false) {
                recordChatInputContent(span, params.messages, params.tools);
            }

            const result = await callModelWithOptions(rest, (model, options) =>
                model.generate(options)
            );

            if (span) {
                recordChatUsage(span, result.usage);
                recordFinishReason(span, result.finishReason);

                if (telemetry?.recordContent !== false) {
                    recordChatOutputContent(span, result);
                }
            }

            return result;
        }
    );
}
