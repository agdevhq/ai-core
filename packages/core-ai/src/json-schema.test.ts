import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodSchemaToJsonSchema } from './json-schema.ts';

describe('zodSchemaToJsonSchema', () => {
    it('should convert a basic object schema', () => {
        const schema = z.object({
            name: z.string(),
            age: z.number(),
        });

        const jsonSchema = zodSchemaToJsonSchema(schema);

        expect(jsonSchema).toMatchObject({
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
            },
            required: ['name', 'age'],
        });
    });

    it('should treat .default() fields as optional (input mode)', () => {
        const schema = z.object({
            query: z.string(),
            limit: z.number().default(10),
        });

        const jsonSchema = zodSchemaToJsonSchema(schema);

        expect(jsonSchema).toMatchObject({
            type: 'object',
            properties: {
                query: { type: 'string' },
                limit: { type: 'number' },
            },
        });
        const required = jsonSchema['required'] as string[];
        expect(required).toContain('query');
        expect(required).not.toContain('limit');
    });

    it('should serialize the input type for transforms', () => {
        const schema = z.object({
            value: z.string().transform((val) => val.length),
        });

        const jsonSchema = zodSchemaToJsonSchema(schema);

        expect(jsonSchema).toMatchObject({
            type: 'object',
            properties: {
                value: { type: 'string' },
            },
        });
    });

    it('should throw for unrepresentable types like z.date()', () => {
        const schema = z.object({
            timestamp: z.date(),
        });

        expect(() => zodSchemaToJsonSchema(schema)).toThrow();
    });
});
