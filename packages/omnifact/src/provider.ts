import OpenAI from 'openai';
import type { ChatModel } from '@core-ai/core-ai';
import { createOpenAICompatChatModel } from '@core-ai/openai/compat';
import { DEFAULT_BASE_URL } from './constants.js';

export type OmnifactProviderOptions = {
    apiKey?: string;
    baseURL?: string;
    client?: OpenAI;
};

export type OmnifactProvider = {
    chatModel(modelId: string): ChatModel;
};

export function createOmnifact(
    options: OmnifactProviderOptions = {}
): OmnifactProvider {
    const client =
        options.client ??
        new OpenAI({
            apiKey: options.apiKey,
            baseURL: options.baseURL ?? DEFAULT_BASE_URL,
        });

    return {
        chatModel: (modelId) =>
            createOpenAICompatChatModel(client, modelId, 'omnifact'),
    };
}
