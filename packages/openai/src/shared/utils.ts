import type { GenerateOptions } from '@core-ai/core-ai';
import { ProviderError } from '@core-ai/core-ai';

import { getOpenAIModelCapabilities } from '../model-capabilities.js';

export { safeParseJsonObject } from '@core-ai/core-ai';

export function validateOpenAIReasoningConfig(
    modelId: string,
    options: GenerateOptions
): void {
    if (!options.reasoning) {
        return;
    }

    const capabilities = getOpenAIModelCapabilities(modelId);
    if (!capabilities.reasoning.restrictsSamplingParams) {
        return;
    }

    if (options.temperature !== undefined) {
        throw new ProviderError(
            `OpenAI model "${modelId}" does not support temperature when reasoning is enabled`,
            'openai'
        );
    }

    if (options.topP !== undefined) {
        throw new ProviderError(
            `OpenAI model "${modelId}" does not support topP when reasoning is enabled`,
            'openai'
        );
    }
}
