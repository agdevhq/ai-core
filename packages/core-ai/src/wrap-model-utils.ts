type Execute<TOptions, TResult> = (options: TOptions) => Promise<TResult>;

type ModelOperationMiddleware<TModel, TOptions, TResult> = (args: {
    execute: (options?: TOptions) => Promise<TResult>;
    options: TOptions;
    model: TModel;
}) => Promise<TResult>;

export function buildMiddlewareChain<TModel, TOptions, TResult>(config: {
    model: TModel;
    operations: ModelOperationMiddleware<TModel, TOptions, TResult>[];
    finalExecute: Execute<TOptions, TResult>;
}): Execute<TOptions, TResult> {
    const { model, operations, finalExecute } = config;

    return operations.reduceRight<Execute<TOptions, TResult>>(
        (nextExecute, operation) => {
            return (options) =>
                operation({
                    execute: (overrideOptions) =>
                        nextExecute(overrideOptions ?? options),
                    options,
                    model,
                });
        },
        finalExecute
    );
}

export function normalizeMiddleware<T>(middleware: T | T[]): T[] {
    return Array.isArray(middleware) ? middleware : [middleware];
}
