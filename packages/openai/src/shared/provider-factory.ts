import OpenAI from 'openai';
import type { ChatModel, EmbeddingModel, ImageModel } from '@core-ai/core-ai';

import { createOpenAIEmbeddingModel } from '../embedding-model.js';
import { createOpenAIImageModel } from '../image-model.js';

export type OpenAIProviderBaseOptions = {
    apiKey?: string;
    baseURL?: string;
    client?: OpenAI;
};

export type OpenAIProvider = {
    chatModel(modelId: string): ChatModel;
    embeddingModel(modelId: string): EmbeddingModel;
    imageModel(modelId: string): ImageModel;
};

export function createOpenAIProvider(
    options: OpenAIProviderBaseOptions,
    createChatModel: (client: OpenAI, modelId: string) => ChatModel
): OpenAIProvider {
    const client =
        options.client ??
        new OpenAI({
            apiKey: options.apiKey,
            baseURL: options.baseURL,
        });

    return {
        chatModel: (modelId) => createChatModel(client, modelId),
        embeddingModel: (modelId) => createOpenAIEmbeddingModel(client, modelId),
        imageModel: (modelId) => createOpenAIImageModel(client, modelId),
    };
}
