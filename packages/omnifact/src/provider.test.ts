import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BASE_URL } from './constants.js';
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

    it('should default baseURL to the Omnifact gateway when no client is provided', () => {
        const provider = createOmnifact({
            apiKey: 'test-key',
        });

        const chatModel = provider.chatModel('gpt-5-mini');

        expect(chatModel.provider).toBe('omnifact');
        expect(chatModel.modelId).toBe('gpt-5-mini');
        expect(DEFAULT_BASE_URL).toBe('https://connect.omnifact.ai/v1/gateway');
    });

    it('should allow overriding baseURL', () => {
        const provider = createOmnifact({
            apiKey: 'test-key',
            baseURL: 'http://localhost:3001/v1/gateway',
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
});

function createMockClient(overrides?: {
    chatCreate?: (options: unknown) => Promise<unknown>;
}): OpenAI {
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
    } as unknown as OpenAI;
}
