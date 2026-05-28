import { createOmnifact } from '../../../../packages/omnifact/src/index.ts';
import { getEnvOrDefault, getEnvValue, hasApiKey } from '../env.ts';
import type { ProviderE2EAdapter } from './provider-adapter.ts';

const OMNIFACT_API_KEY_ENV = 'OMNIFACT_API_KEY';
const OMNIFACT_BASE_URL_ENV = 'OMNIFACT_BASE_URL';
const OMNIFACT_CHAT_MODEL_ENV = 'OMNIFACT_E2E_CHAT_MODEL';

export function createOmnifactAdapter(): ProviderE2EAdapter {
    const chatModelId = getEnvOrDefault(
        OMNIFACT_CHAT_MODEL_ENV,
        'gpt-5-mini'
    );
    const baseURL = getEnvOrDefault(
        OMNIFACT_BASE_URL_ENV,
        'http://localhost:3001/v1/gateway'
    );

    return {
        id: 'omnifact',
        displayName: 'Omnifact',
        apiKeyEnvVar: OMNIFACT_API_KEY_ENV,
        models: {
            chat: chatModelId,
        },
        capabilities: {
            chat: true,
            stream: true,
            object: false,
            reasoning: false,
            embedding: false,
            image: false,
        },
        isConfigured: () => hasApiKey(OMNIFACT_API_KEY_ENV),
        createChatModel: () =>
            createOmnifact({
                apiKey: getEnvValue(OMNIFACT_API_KEY_ENV),
                baseURL,
            }).chatModel(chatModelId),
    };
}
