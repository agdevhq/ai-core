import type { z } from 'zod';
import { generate } from './generate.ts';
import {
    extractStructuredValue,
    prepareStructuredGenerateOptions,
    validateStructuredValue,
} from './structured-output.ts';
import type { GenerateObjectParams, GenerateObjectResult } from './types.ts';

export async function generateObject<TSchema extends z.ZodTypeAny>(
    params: GenerateObjectParams<TSchema>
): Promise<GenerateObjectResult<TSchema>> {
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

    const raw = await generate({
        model,
        ...prepared.options,
    });

    const extracted = extractStructuredValue({
        result: raw,
        strategy: prepared.strategy,
        schemaToolName: prepared.schemaToolName,
        provider: model.provider,
        modelId: model.modelId,
    });

    const object = validateStructuredValue({
        schema,
        value: extracted.value,
        rawText: extracted.rawText,
        provider: model.provider,
        modelId: model.modelId,
    });

    return {
        object,
        finishReason: raw.finishReason,
        usage: raw.usage,
        raw,
    };
}
