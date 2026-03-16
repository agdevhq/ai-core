import { assertNonEmptyPrompt } from './assertions.ts';
import { callModelWithOptions } from './model-options.ts';
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
    return callModelWithOptions(params, (model, options) =>
        model.generate(options)
    );
}
