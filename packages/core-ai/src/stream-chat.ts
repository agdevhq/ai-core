import { assertNonEmptyMessages } from './assertions.ts';
import { callModelWithOptions } from './model-options.ts';
import {
    endSpan,
    recordChatInputContent,
    recordChatOutputContent,
    recordChatUsage,
    recordFinishReason,
    startSpan,
} from './telemetry.ts';
import type { ChatModel, GenerateOptions, ChatStream } from './types.ts';

export type StreamParams = GenerateOptions & {
    model: ChatModel;
};

export async function stream(params: StreamParams): Promise<ChatStream> {
    assertNonEmptyMessages(params.messages);
    const { telemetry, ...rest } = params;
    const activeSpan = startSpan({
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
    });
    const span = activeSpan?.span;

    try {
        if (span && telemetry?.recordContent !== false) {
            recordChatInputContent(span, params.messages, params.tools);
        }

        const doCall = () =>
            callModelWithOptions(rest, (model, options) => model.stream(options));
        const chatStream = activeSpan
            ? await activeSpan.withContext(doCall)
            : await doCall();

        if (span) {
            void chatStream.result
                .then((result) => {
                    recordChatUsage(span, result.usage);
                    recordFinishReason(span, result.finishReason);

                    if (telemetry?.recordContent !== false) {
                        recordChatOutputContent(span, result);
                    }

                    endSpan(span);
                })
                .catch((error: unknown) => {
                    endSpan(span, error);
                });
        }

        return chatStream;
    } catch (error) {
        if (span) {
            endSpan(span, error);
        }

        throw error;
    }
}
