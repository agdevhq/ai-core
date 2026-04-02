import { assertNonEmptyPrompt } from './assertions.ts';
import { callModelWithOptions } from './model-options.ts';
import { recordImageInputContent, withSpan } from './telemetry.ts';
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
    const { telemetry, ...rest } = params;

    return withSpan(
        {
            name: `image_generation ${params.model.modelId}`,
            attributes: {
                'gen_ai.provider.name': params.model.provider,
                'gen_ai.request.model': params.model.modelId,
                'gen_ai.operation.name': 'image_generation',
                'gen_ai.output.type': 'image',
            },
            telemetry,
        },
        async (span) => {
            if (span && telemetry?.recordContent !== false) {
                recordImageInputContent(span, params.prompt);
            }

            return callModelWithOptions(rest, (model, options) =>
                model.generate(options)
            );
        }
    );
}
