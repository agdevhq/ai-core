import { buildMiddlewareChain, normalizeMiddleware } from './wrap-model-utils.ts';
import type {
    EmbedOptions,
    EmbedResult,
    EmbeddingModel,
    EmbeddingModelMiddleware,
} from './types.ts';

type EmbedOperation = NonNullable<EmbeddingModelMiddleware['embed']>;

export function wrapEmbeddingModel(config: {
    model: EmbeddingModel;
    middleware: EmbeddingModelMiddleware | EmbeddingModelMiddleware[];
}): EmbeddingModel {
    const middlewares = normalizeMiddleware(config.middleware);
    const { model } = config;

    return {
        provider: model.provider,
        modelId: model.modelId,
        embed(options: EmbedOptions): Promise<EmbedResult> {
            const operations: EmbedOperation[] = middlewares.flatMap((middleware) =>
                middleware.embed ? [middleware.embed] : []
            );

            return buildMiddlewareChain({
                model,
                operations,
                finalExecute: (nextOptions) => model.embed(nextOptions),
            })(options);
        },
    };
}
