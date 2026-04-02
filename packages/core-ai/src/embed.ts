import { assertNonEmptyEmbedInput } from './assertions.ts';
import { callModelWithOptions } from './model-options.ts';
import {
    recordEmbedInputContent,
    recordEmbedUsage,
    withSpan,
} from './telemetry.ts';
import type { EmbeddingModel, EmbedOptions, EmbedResult } from './types.ts';

export type EmbedParams = EmbedOptions & {
    model: EmbeddingModel;
};

export async function embed(params: EmbedParams): Promise<EmbedResult> {
    assertNonEmptyEmbedInput(params.input);
    const { telemetry, ...rest } = params;

    return withSpan(
        {
            name: `embeddings ${params.model.modelId}`,
            attributes: {
                'gen_ai.provider.name': params.model.provider,
                'gen_ai.request.model': params.model.modelId,
                'gen_ai.operation.name': 'embeddings',
            },
            telemetry,
        },
        async (span) => {
            if (span && telemetry?.recordContent !== false) {
                recordEmbedInputContent(span, params.input);
            }

            const result = await callModelWithOptions(rest, (model, options) =>
                model.embed(options)
            );

            if (span) {
                recordEmbedUsage(span, result.usage);
            }

            return result;
        }
    );
}
