import { assertNonEmptyPrompt } from './assertions.ts';
import { splitModelFromParams } from './model-options.ts';
import type {
    ImageGenerateOptions,
    ImageGenerateResult,
    ImageModel,
} from './types.ts';

export type GenerateImageParams = ImageGenerateOptions & {
    model: ImageModel;
};

export async function generateImage(
    params: GenerateImageParams
): Promise<ImageGenerateResult> {
    assertNonEmptyPrompt(params.prompt);

    const { model, options } = splitModelFromParams(params);
    return model.generate(options);
}
