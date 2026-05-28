import type OpenAI from 'openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '@core-ai/core-ai';
import { DEFAULT_BASE_URL } from './constants.js';
import { createOmnifact } from './provider.js';

const { OpenAIConstructorMock } = vi.hoisted(() => ({
    OpenAIConstructorMock: vi.fn(),
}));

vi.mock('openai', async (importOriginal) => {
    const real = await importOriginal<typeof import('openai')>();
    return { ...real, default: OpenAIConstructorMock };
});

describe('createOmnifact', () => {
    beforeEach(() => {
        OpenAIConstructorMock.mockReset();
        OpenAIConstructorMock.mockImplementation(() => createMockClient());
    });

    it('should create a chat model with provider omnifact', () => {
        const provider = createOmnifact({
            client: createMockClient(),
        });

        const chatModel = provider.chatModel('gpt-5-mini');

        expect(chatModel.provider).toBe('omnifact');
        expect(chatModel.modelId).toBe('gpt-5-mini');
        expect(OpenAIConstructorMock).not.toHaveBeenCalled();
    });

    it('should construct OpenAI with the default gateway baseURL when no client is provided', () => {
        createOmnifact({
            apiKey: 'test-key',
        });

        expect(OpenAIConstructorMock).toHaveBeenCalledOnce();
        expect(OpenAIConstructorMock).toHaveBeenCalledWith({
            apiKey: 'test-key',
            baseURL: DEFAULT_BASE_URL,
        });
    });

    it('should construct OpenAI with a custom baseURL when no client is provided', () => {
        createOmnifact({
            apiKey: 'test-key',
            baseURL: 'http://localhost:3001/v1/gateway',
        });

        expect(OpenAIConstructorMock).toHaveBeenCalledOnce();
        expect(OpenAIConstructorMock).toHaveBeenCalledWith({
            apiKey: 'test-key',
            baseURL: 'http://localhost:3001/v1/gateway',
        });
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
        expect(OpenAIConstructorMock).not.toHaveBeenCalled();
    });

    it('should tag errors with provider "omnifact"', async () => {
        const chatCreate = vi.fn(async () => {
            throw Object.assign(new Error('upstream failure'), {
                status: 500,
                headers: {},
                error: {},
                name: 'APIError',
                constructor: { name: 'APIError' },
            });
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
