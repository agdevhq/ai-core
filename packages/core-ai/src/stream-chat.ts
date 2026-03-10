import { assertNonEmptyMessages } from './assertions.ts';
import { splitModelFromParams } from './model-options.ts';
import type { ChatModel, GenerateOptions, ChatStream } from './types.ts';

export type StreamParams = GenerateOptions & {
    model: ChatModel;
};

export async function stream(params: StreamParams): Promise<ChatStream> {
    assertNonEmptyMessages(params.messages);

    const { model, options } = splitModelFromParams(params);
    return model.stream(options);
}
