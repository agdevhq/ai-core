export function splitModelFromParams<
    TParams extends {
        model: unknown;
    },
>(params: TParams): {
    model: TParams['model'];
    options: Omit<TParams, 'model'>;
} {
    const { model, ...options } = params;
    return {
        model,
        options,
    };
}
