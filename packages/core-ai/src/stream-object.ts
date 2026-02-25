import type { z } from 'zod';
import { createObjectStreamResult } from './object-stream.ts';
import { prepareStructuredGenerateOptions } from './structured-output.ts';
import { stream } from './stream-chat.ts';
import type { GenerateObjectParams, ObjectStreamResult } from './types.ts';

export async function streamObject<TSchema extends z.ZodTypeAny>(
    params: GenerateObjectParams<TSchema>
): Promise<ObjectStreamResult<TSchema>> {
    const { model, schema, mode, schemaName, schemaDescription, ...options } =
        params;

    const prepared = prepareStructuredGenerateOptions({
        provider: model.provider,
        schema,
        mode,
        schemaName,
        schemaDescription,
        options,
    });

    const rawStream = await stream({
        model,
        ...prepared.options,
    });

    return createObjectStreamResult({
        source: rawStream,
        schema,
        strategy: prepared.strategy,
        schemaToolName: prepared.schemaToolName,
        provider: model.provider,
        modelId: model.modelId,
    });
}
