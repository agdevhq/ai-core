import type { z } from 'zod';
import { buildMiddlewareChain, normalizeMiddleware } from './wrap-model-utils.ts';
import type {
    ChatModel,
    ChatModelMiddleware,
    ChatStream,
    GenerateObjectOptions,
    GenerateObjectResult,
    GenerateOptions,
    GenerateResult,
    ObjectStream,
    StreamObjectOptions,
} from './types.ts';

type GenerateOperation = NonNullable<ChatModelMiddleware['generate']>;
type StreamOperation = NonNullable<ChatModelMiddleware['stream']>;
type GenerateObjectOperation<TSchema extends z.ZodType> = (args: {
    execute: (
        options?: GenerateObjectOptions<TSchema>
    ) => Promise<GenerateObjectResult<TSchema>>;
    options: GenerateObjectOptions<TSchema>;
    model: ChatModel;
}) => Promise<GenerateObjectResult<TSchema>>;
type StreamObjectOperation<TSchema extends z.ZodType> = (args: {
    execute: (options?: StreamObjectOptions<TSchema>) => Promise<ObjectStream<TSchema>>;
    options: StreamObjectOptions<TSchema>;
    model: ChatModel;
}) => Promise<ObjectStream<TSchema>>;

export function wrapChatModel(config: {
    model: ChatModel;
    middleware: ChatModelMiddleware | ChatModelMiddleware[];
}): ChatModel {
    const middlewares = normalizeMiddleware(config.middleware);
    const { model } = config;

    return {
        provider: model.provider,
        modelId: model.modelId,
        generate(options: GenerateOptions): Promise<GenerateResult> {
            const operations: GenerateOperation[] = middlewares.flatMap((middleware) =>
                middleware.generate ? [middleware.generate] : []
            );

            return buildMiddlewareChain({
                model,
                operations,
                finalExecute: (nextOptions) => model.generate(nextOptions),
            })(options);
        },
        stream(options: GenerateOptions): Promise<ChatStream> {
            const operations: StreamOperation[] = middlewares.flatMap((middleware) =>
                middleware.stream ? [middleware.stream] : []
            );

            return buildMiddlewareChain({
                model,
                operations,
                finalExecute: (nextOptions) => model.stream(nextOptions),
            })(options);
        },
        generateObject<TSchema extends z.ZodType>(
            options: GenerateObjectOptions<TSchema>
        ): Promise<GenerateObjectResult<TSchema>> {
            const operations: GenerateObjectOperation<TSchema>[] = middlewares.flatMap(
                (middleware) =>
                    middleware.generateObject
                        ? [middleware.generateObject as GenerateObjectOperation<TSchema>]
                        : []
            );

            return buildMiddlewareChain({
                model,
                operations,
                finalExecute: (nextOptions) => model.generateObject(nextOptions),
            })(options);
        },
        streamObject<TSchema extends z.ZodType>(
            options: StreamObjectOptions<TSchema>
        ): Promise<ObjectStream<TSchema>> {
            const operations: StreamObjectOperation<TSchema>[] = middlewares.flatMap(
                (middleware) =>
                    middleware.streamObject
                        ? [middleware.streamObject as StreamObjectOperation<TSchema>]
                        : []
            );

            return buildMiddlewareChain({
                model,
                operations,
                finalExecute: (nextOptions) => model.streamObject(nextOptions),
            })(options);
        },
    };
}
