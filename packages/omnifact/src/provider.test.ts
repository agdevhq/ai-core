import type { OpenAIChatClient } from '@core-ai/openai/compat';
import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '@core-ai/core-ai';
import { createOmnifact } from './provider.js';

describe('createOmnifact', () => {
    it('should create a chat model with provider omnifact', () => {
        const provider = createOmnifact({
            client: createMockClient(),
        });

        const chatModel = provider.chatModel('gpt-5-mini');

        expect(chatModel.provider).toBe('omnifact');
        expect(chatModel.modelId).toBe('gpt-5-mini');
    });

    it('should use a shared client instance when injected', async () => {
        const chatCreate = vi.fn(async () => ({
            id: 'chatcmpl-1',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-5-mini',
            choices: [
                {
                    index: 0,
                    finish_reason: 'stop',
                    logprobs: null,
                    message: {
                        role: 'assistant',
                        content: 'ok',
                        refusal: null,
                    },
                },
            ],
            usage: {
                prompt_tokens: 1,
                completion_tokens: 1,
                total_tokens: 2,
            },
        }));

        const provider = createOmnifact({
            client: createMockClient({ chatCreate }),
        });

        await provider
            .chatModel('gpt-5-mini')
            .generate({ messages: [{ role: 'user', content: 'hello' }] });

        expect(chatCreate).toHaveBeenCalledTimes(1);
    });

    it('should tag errors with provider "omnifact"', async () => {
        const chatCreate = vi.fn(async () => {
            throw new Error('upstream failure');
        });

        const provider = createOmnifact({
            client: createMockClient({ chatCreate }),
        });

        const error = await provider
            .chatModel('eu/gpt-5-mini')
            .generate({ messages: [{ role: 'user', content: 'hello' }] })
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).provider).toBe('omnifact');
    });
});

function createMockClient(overrides?: {
    chatCreate?: (options: unknown) => Promise<unknown>;
}): OpenAIChatClient {
    const chatCreate =
        overrides?.chatCreate ??
        (async () => {
            throw new Error('chat create not implemented');
        });

    return {
        chat: {
            completions: {
                create: chatCreate,
            },
        },
    } as unknown as OpenAIChatClient;
}
