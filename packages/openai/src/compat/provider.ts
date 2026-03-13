import { createOpenAICompatChatModel } from './chat-model.js';
import {
    createOpenAIProvider,
    type OpenAIProvider,
    type OpenAIProviderBaseOptions,
} from '../shared/provider-factory.js';

export type OpenAICompatProviderOptions = OpenAIProviderBaseOptions;
export type OpenAICompatProvider = OpenAIProvider;

export function createOpenAICompat(
    options: OpenAICompatProviderOptions = {}
): OpenAICompatProvider {
    return createOpenAIProvider(options, createOpenAICompatChatModel);
}
