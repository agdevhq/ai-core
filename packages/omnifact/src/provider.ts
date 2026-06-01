import type { ChatModel } from '@core-ai/core-ai';
import {
    createOpenAICompatChatProvider,
    type OpenAIChatClient,
} from '@core-ai/openai/compat';
import { DEFAULT_BASE_URL } from './constants.js';

export type OmnifactProviderOptions = {
    apiKey?: string;
    baseURL?: string;
    client?: OpenAIChatClient;
};

export type OmnifactProvider = {
    chatModel(modelId: string): ChatModel;
};

export function createOmnifact(
    options: OmnifactProviderOptions = {}
): OmnifactProvider {
    if (!options.client && !options.apiKey) {
        throw new Error(
            'createOmnifact: apiKey is required when no client is provided.'
        );
    }

    return createOpenAICompatChatProvider(
        {
            apiKey: options.apiKey,
            baseURL: options.baseURL ?? DEFAULT_BASE_URL,
            client: options.client,
        },
        'omnifact'
    );
}
