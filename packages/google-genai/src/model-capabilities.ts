import {
    stripModelDateSuffix,
    type ReasoningEffort,
} from '@core-ai/core-ai';

export type GoogleModelCapabilities = {
    reasoning: {
        thinkingParam: 'thinkingLevel' | 'thinkingBudget';
        canDisableThinking: boolean;
    };
};

const DEFAULT_CAPABILITIES: GoogleModelCapabilities = {
    reasoning: {
        thinkingParam: 'thinkingBudget',
        canDisableThinking: true,
    },
};

const MODEL_CAPABILITIES: Record<string, GoogleModelCapabilities> = {
    'gemini-3.1-pro': {
        reasoning: {
            thinkingParam: 'thinkingLevel',
            canDisableThinking: false,
        },
    },
    'gemini-3.1-flash-lite-preview': {
        reasoning: {
            thinkingParam: 'thinkingLevel',
            canDisableThinking: false,
        },
    },
    'gemini-3-pro': {
        reasoning: {
            thinkingParam: 'thinkingLevel',
            canDisableThinking: false,
        },
    },
    'gemini-2.5-pro': {
        reasoning: {
            thinkingParam: 'thinkingBudget',
            canDisableThinking: false,
        },
    },
    'gemini-2.5-flash': {
        reasoning: {
            thinkingParam: 'thinkingBudget',
            canDisableThinking: true,
        },
    },
    'gemini-2.5-flash-lite': {
        reasoning: {
            thinkingParam: 'thinkingBudget',
            canDisableThinking: true,
        },
    },
};

const GOOGLE_THINKING_LEVEL_MAP: Record<ReasoningEffort, 'LOW' | 'HIGH'> = {
    minimal: 'LOW',
    low: 'LOW',
    medium: 'LOW',
    high: 'HIGH',
    max: 'HIGH',
};

const GOOGLE_THINKING_BUDGET_MAP: Record<ReasoningEffort, number> = {
    minimal: 1024,
    low: 4096,
    medium: 16384,
    high: 32768,
    max: 32768,
};

export function getGoogleModelCapabilities(
    modelId: string
): GoogleModelCapabilities {
    const normalizedModelId = normalizeModelId(modelId);
    return MODEL_CAPABILITIES[normalizedModelId] ?? DEFAULT_CAPABILITIES;
}

export function normalizeModelId(modelId: string): string {
    return stripModelDateSuffix(modelId);
}

export function toGoogleThinkingLevel(effort: ReasoningEffort): 'LOW' | 'HIGH' {
    return GOOGLE_THINKING_LEVEL_MAP[effort];
}

export function toGoogleThinkingBudget(effort: ReasoningEffort): number {
    return GOOGLE_THINKING_BUDGET_MAP[effort];
}
