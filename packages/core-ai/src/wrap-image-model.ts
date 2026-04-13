import { buildMiddlewareChain, normalizeMiddleware } from './wrap-model-utils.ts';
import type {
    ImageGenerateOptions,
    ImageGenerateResult,
    ImageModel,
    ImageModelMiddleware,
} from './types.ts';

type GenerateOperation = NonNullable<ImageModelMiddleware['generate']>;

export function wrapImageModel(config: {
    model: ImageModel;
    middleware: ImageModelMiddleware | ImageModelMiddleware[];
}): ImageModel {
    const middlewares = normalizeMiddleware(config.middleware);
    const { model } = config;

    return {
        provider: model.provider,
        modelId: model.modelId,
        generate(options: ImageGenerateOptions): Promise<ImageGenerateResult> {
            const operations: GenerateOperation[] = middlewares.flatMap((middleware) =>
                middleware.generate ? [middleware.generate] : []
            );

            return buildMiddlewareChain({
                model,
                operations,
                finalExecute: (nextOptions) => model.generate(nextOptions),
            })(options);
        },
    };
}
