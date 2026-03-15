import { normalizeProviderModelId, type ReasoningEffort } from '@core-ai/core-ai';

export type AnthropicModelCapabilities = {
    reasoning: {
        thinkingMode: 'adaptive' | 'manual';
        supportsMaxEffort: boolean;
    };
};

const DEFAULT_CAPABILITIES: AnthropicModelCapabilities = {
    reasoning: {
        thinkingMode: 'adaptive',
        supportsMaxEffort: false,
    },
};

const MODEL_CAPABILITIES: Record<string, AnthropicModelCapabilities> = {
    'claude-opus-4-6': {
        reasoning: {
            thinkingMode: 'adaptive',
            supportsMaxEffort: true,
        },
    },
    'claude-sonnet-4-6': {
        reasoning: {
            thinkingMode: 'adaptive',
            supportsMaxEffort: false,
        },
    },
    'claude-opus-4-5': {
        reasoning: {
            thinkingMode: 'manual',
            supportsMaxEffort: false,
        },
    },
    'claude-sonnet-4-5': {
        reasoning: {
            thinkingMode: 'manual',
            supportsMaxEffort: false,
        },
    },
    'claude-opus-4-1': {
        reasoning: {
            thinkingMode: 'manual',
            supportsMaxEffort: false,
        },
    },
    'claude-opus-4': {
        reasoning: {
            thinkingMode: 'manual',
            supportsMaxEffort: false,
        },
    },
    'claude-sonnet-4': {
        reasoning: {
            thinkingMode: 'manual',
            supportsMaxEffort: false,
        },
    },
    'claude-haiku-4-5': {
        reasoning: {
            thinkingMode: 'manual',
            supportsMaxEffort: false,
        },
    },
    'claude-sonnet-3-7': {
        reasoning: {
            thinkingMode: 'manual',
            supportsMaxEffort: false,
        },
    },
};

const MANUAL_BUDGET_BY_EFFORT: Record<ReasoningEffort, number> = {
    minimal: 1024,
    low: 2048,
    medium: 8192,
    high: 32768,
    max: 65536,
};

export function getAnthropicModelCapabilities(
    modelId: string
): AnthropicModelCapabilities {
    const normalizedModelId = normalizeModelId(modelId);
    return MODEL_CAPABILITIES[normalizedModelId] ?? DEFAULT_CAPABILITIES;
}

export function normalizeModelId(modelId: string): string {
    return normalizeProviderModelId(modelId);
}

export function toAnthropicAdaptiveEffort(
    effort: ReasoningEffort,
    supportsMaxEffort: boolean
): 'low' | 'medium' | 'high' | 'max' {
    if (effort === 'minimal') {
        return 'low';
    }
    if (effort === 'max') {
        return supportsMaxEffort ? 'max' : 'high';
    }
    return effort;
}

export function toAnthropicManualBudget(effort: ReasoningEffort): number {
    return MANUAL_BUDGET_BY_EFFORT[effort];
}
