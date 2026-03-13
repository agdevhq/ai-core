import { z } from 'zod';

/**
 * Convert a Zod schema to a JSON Schema object using Zod 4's native
 * `z.toJSONSchema()`.
 */
export function zodSchemaToJsonSchema(
    schema: z.ZodType
): Record<string, unknown> {
    return z.toJSONSchema(schema, {
        io: 'input',
    }) as Record<string, unknown>;
}
