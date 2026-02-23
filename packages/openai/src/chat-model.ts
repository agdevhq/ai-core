import type OpenAI from 'openai';
import type {
    ChatModel,
    GenerateOptions,
    StreamResult,
    GenerateResult,
} from '@core-ai/core-ai';
import { createStreamResult } from '@core-ai/core-ai';
import {
    createGenerateRequest,
    createStreamRequest,
    mapGenerateResponse,
    transformStream,
    wrapError,
} from './chat-adapter.js';

type OpenAIChatClient = {
    chat: OpenAI['chat'];
};

export function createOpenAIChatModel(
    client: OpenAIChatClient,
    modelId: string
): ChatModel {
    return {
        provider: 'openai',
        modelId,
        async generate(options: GenerateOptions): Promise<GenerateResult> {
            try {
                const request = createGenerateRequest(modelId, options);
                const response = await client.chat.completions.create(request);
                return mapGenerateResponse(response);
            } catch (error) {
                throw wrapError(error);
            }
        },
        async stream(options: GenerateOptions): Promise<StreamResult> {
            try {
                const request = createStreamRequest(modelId, options);
                const stream = await client.chat.completions.create(request);
                return createStreamResult(transformStream(stream));
            } catch (error) {
                throw wrapError(error);
            }
        },
    };
}
