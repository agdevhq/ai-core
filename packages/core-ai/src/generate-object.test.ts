import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { LLMError, StructuredOutputValidationError } from './errors.ts';
import { generateObject } from './generate-object.ts';
import type { ChatModel, GenerateResult } from './types.ts';

function createGenerateResult(content: string | null): GenerateResult {
    return {
        content,
        toolCalls: [],
        finishReason: 'stop',
        usage: {
            inputTokens: 4,
            outputTokens: 2,
            reasoningTokens: 0,
            totalTokens: 6,
        },
    };
}

function createMockChatModel(
    result: GenerateResult,
    provider = 'openai'
): ChatModel {
    return {
        provider,
        modelId: 'test-model',
        generate: vi.fn(async () => result),
        stream: vi.fn(async () => {
            throw new Error('not implemented');
        }),
    };
}

describe('generateObject', () => {
    it('returns validated typed objects', async () => {
        const model = createMockChatModel(
            createGenerateResult('{"name":"Ada","age":37}')
        );
        const schema = z.object({
            name: z.string(),
            age: z.number(),
        });

        const result = await generateObject({
            model,
            messages: [{ role: 'user', content: 'Return profile JSON' }],
            schema,
        });

        expect(result.object).toEqual({
            name: 'Ada',
            age: 37,
        });
        expect(result.raw.content).toBe('{"name":"Ada","age":37}');
        expect(model.generate).toHaveBeenCalledWith(
            expect.objectContaining({
                providerOptions: expect.objectContaining({
                    response_format: expect.objectContaining({
                        type: 'json_schema',
                    }),
                }),
            })
        );
    });

    it('throws StructuredOutputValidationError for invalid JSON', async () => {
        const model = createMockChatModel(createGenerateResult('not-json'));

        await expect(
            generateObject({
                model,
                messages: [{ role: 'user', content: 'Return JSON' }],
                schema: z.object({
                    ok: z.boolean(),
                }),
            })
        ).rejects.toBeInstanceOf(StructuredOutputValidationError);
    });

    it('throws LLMError for empty messages', async () => {
        const model = createMockChatModel(createGenerateResult('{"ok":true}'));

        await expect(
            generateObject({
                model,
                messages: [],
                schema: z.object({
                    ok: z.boolean(),
                }),
            })
        ).rejects.toBeInstanceOf(LLMError);
    });
});
