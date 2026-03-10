import { assertNonEmptyMessages } from './assertions.ts';
import { splitModelFromParams } from './model-options.ts';
import type { ChatModel, GenerateOptions, GenerateResult } from './types.ts';

export type GenerateParams = GenerateOptions & {
    model: ChatModel;
};

export async function generate(
    params: GenerateParams
): Promise<GenerateResult> {
    assertNonEmptyMessages(params.messages);

    const { model, options } = splitModelFromParams(params);
    return model.generate(options);
}
