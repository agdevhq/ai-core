import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { StructuredOutputValidationError } from './errors.ts';
import { createStreamResult } from './stream.ts';
import { streamObject } from './stream-object.ts';
import type { ChatModel, StreamEvent, StreamResult } from './types.ts';

const usage = {
    inputTokens: 5,
    outputTokens: 3,
    reasoningTokens: 0,
    totalTokens: 8,
} as const;

function createMockModel(provider: string, streamResult: StreamResult): ChatModel {
    return {
        provider,
        modelId: 'test-model',
        generate: vi.fn(async () => {
            throw new Error('not implemented');
        }),
        stream: vi.fn(async () => streamResult),
    };
}

describe('streamObject', () => {
    it('emits deltas and resolves toResponse()', async () => {
        const events: StreamEvent[] = [
            { type: 'content-delta', text: '{"name":"Ada",' },
            { type: 'content-delta', text: '"age":37}' },
            { type: 'finish', finishReason: 'stop', usage },
        ];
        const model = createMockModel('mistral', createStreamResult(toAsync(events)));
        const result = await streamObject({
            model,
            messages: [{ role: 'user', content: 'Return JSON' }],
            schema: z.object({
                name: z.string(),
                age: z.number(),
            }),
        });

        const jsonDeltas: string[] = [];
        const objectDeltas: unknown[] = [];
        let finishCount = 0;

        for await (const event of result) {
            if (event.type === 'json-delta') {
                jsonDeltas.push(event.text);
            }
            if (event.type === 'object-delta') {
                objectDeltas.push(event.partial);
            }
            if (event.type === 'finish') {
                finishCount += 1;
            }
        }

        expect(jsonDeltas.join('')).toBe('{"name":"Ada","age":37}');
        expect(objectDeltas).toContainEqual({ name: 'Ada', age: 37 });
        expect(finishCount).toBe(1);

        const response = await result.toResponse();
        expect(response.object).toEqual({ name: 'Ada', age: 37 });
        expect(response.finishReason).toBe('stop');
    });

    it('supports tool-mode streaming in auto mode', async () => {
        const events: StreamEvent[] = [
            {
                type: 'tool-call-start',
                toolCallId: 'tool-1',
                toolName: 'return_response',
            },
            {
                type: 'tool-call-delta',
                toolCallId: 'tool-1',
                argumentsDelta: '{"name":"Ada"}',
            },
            {
                type: 'tool-call-end',
                toolCall: {
                    id: 'tool-1',
                    name: 'return_response',
                    arguments: { name: 'Ada' },
                },
            },
            { type: 'finish', finishReason: 'tool-calls', usage },
        ];
        const model = createMockModel(
            'anthropic',
            createStreamResult(toAsync(events))
        );

        const result = await streamObject({
            model,
            messages: [{ role: 'user', content: 'Return JSON' }],
            schema: z.object({
                name: z.string(),
            }),
        });

        const collected = [];
        for await (const event of result) {
            collected.push(event);
        }

        expect(collected.some((event) => event.type === 'json-delta')).toBe(true);
        expect(collected.some((event) => event.type === 'object-delta')).toBe(true);

        const response = await result.toResponse();
        expect(response.object).toEqual({ name: 'Ada' });
    });

    it('rejects invalid JSON responses', async () => {
        const events: StreamEvent[] = [
            { type: 'content-delta', text: 'not-json' },
            { type: 'finish', finishReason: 'stop', usage },
        ];
        const model = createMockModel('mistral', createStreamResult(toAsync(events)));
        const result = await streamObject({
            model,
            messages: [{ role: 'user', content: 'Return JSON' }],
            schema: z.object({
                ok: z.boolean(),
            }),
        });

        await expect(result.toResponse()).rejects.toBeInstanceOf(
            StructuredOutputValidationError
        );
    });

    it('rejects schema validation failures', async () => {
        const events: StreamEvent[] = [
            { type: 'content-delta', text: '{"age":"old"}' },
            { type: 'finish', finishReason: 'stop', usage },
        ];
        const model = createMockModel('mistral', createStreamResult(toAsync(events)));
        const result = await streamObject({
            model,
            messages: [{ role: 'user', content: 'Return JSON' }],
            schema: z.object({
                age: z.number(),
            }),
        });

        await expect(result.toResponse()).rejects.toBeInstanceOf(
            StructuredOutputValidationError
        );
    });
});

async function* toAsync<T>(values: T[]): AsyncIterable<T> {
    for (const value of values) {
        yield value;
    }
}
