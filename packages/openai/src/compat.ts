export { createOpenAICompat } from './compat/provider.js';
export { createOpenAICompatChatModel } from './compat/chat-model.js';
export type {
    OpenAICompatProvider,
    OpenAICompatProviderOptions,
} from './compat/provider.js';
export {
    openaiCompatGenerateProviderOptionsSchema,
    openaiCompatProviderOptionsSchema,
} from './provider-options.js';
export type {
    OpenAICompatGenerateProviderOptions,
    OpenAICompatRequestOptions,
} from './provider-options.js';
