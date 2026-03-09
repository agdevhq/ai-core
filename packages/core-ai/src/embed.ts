import { assertNonEmptyEmbedInput } from './assertions.ts';
import { splitModelFromParams } from './model-options.ts';
import type { EmbeddingModel, EmbedOptions, EmbedResult } from './types.ts';

export type EmbedParams = EmbedOptions & {
    model: EmbeddingModel;
};

export async function embed(params: EmbedParams): Promise<EmbedResult> {
    assertNonEmptyEmbedInput(params.input);

    const { model, options } = splitModelFromParams(params);
    return model.embed(options);
}
