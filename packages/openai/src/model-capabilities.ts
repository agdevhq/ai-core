import {
    stripModelDateSuffix,
    type ReasoningEffort,
} from '@core-ai/core-ai';

export type OpenAIModelCapabilities = {
    reasoning: {
        supportsEffort: boolean;
        supportedRange: readonly ReasoningEffort[];
        restrictsSamplingParams: boolean;
    };
};

const DEFAULT_CAPABILITIES: OpenAIModelCapabilities = {
    reasoning: {
        supportsEffort: true,
        supportedRange: ['low', 'medium', 'high'],
        restrictsSamplingParams: false,
    },
};

const MODEL_CAPABILITIES: Record<string, OpenAIModelCapabilities> = {
    'gpt-5.4': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['low', 'medium', 'high', 'max'],
            restrictsSamplingParams: true,
        },
    },
    'gpt-5.4-pro': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['low', 'medium', 'high', 'max'],
            restrictsSamplingParams: true,
        },
    },
    'gpt-5.2': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['low', 'medium', 'high', 'max'],
            restrictsSamplingParams: true,
        },
    },
    'gpt-5.2-codex': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['low', 'medium', 'high', 'max'],
            restrictsSamplingParams: true,
        },
    },
    'gpt-5.2-pro': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['low', 'medium', 'high', 'max'],
            restrictsSamplingParams: true,
        },
    },
    'gpt-5.1': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['low', 'medium', 'high'],
            restrictsSamplingParams: true,
        },
    },
    'gpt-5': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['minimal', 'low', 'medium', 'high'],
            restrictsSamplingParams: true,
        },
    },
    'gpt-5-mini': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['minimal', 'low', 'medium', 'high'],
            restrictsSamplingParams: true,
        },
    },
    'gpt-5-nano': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['minimal', 'low', 'medium', 'high'],
            restrictsSamplingParams: true,
        },
    },
    o3: {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['low', 'medium', 'high'],
            restrictsSamplingParams: false,
        },
    },
    'o3-mini': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['low', 'medium', 'high'],
            restrictsSamplingParams: false,
        },
    },
    'o4-mini': {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['low', 'medium', 'high'],
            restrictsSamplingParams: false,
        },
    },
    o1: {
        reasoning: {
            supportsEffort: true,
            supportedRange: ['low', 'medium', 'high'],
            restrictsSamplingParams: false,
        },
    },
    'o1-mini': {
        reasoning: {
            supportsEffort: false,
            supportedRange: [],
            restrictsSamplingParams: false,
        },
    },
};

const EFFORT_RANK: Record<ReasoningEffort, number> = {
    minimal: 0,
    low: 1,
    medium: 2,
    high: 3,
    max: 4,
};

const OPENAI_REASONING_EFFORT_MAP: Record<
    ReasoningEffort,
    'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
> = {
    minimal: 'minimal',
    low: 'low',
    medium: 'medium',
    high: 'high',
    max: 'xhigh',
};

export function getOpenAIModelCapabilities(
    modelId: string
): OpenAIModelCapabilities {
    const normalizedModelId = normalizeModelId(modelId);
    return MODEL_CAPABILITIES[normalizedModelId] ?? DEFAULT_CAPABILITIES;
}

export function normalizeModelId(modelId: string): string {
    return stripModelDateSuffix(modelId);
}

export function clampReasoningEffort(
    effort: ReasoningEffort,
    supportedRange: readonly ReasoningEffort[]
): ReasoningEffort {
    if (supportedRange.length === 0 || supportedRange.includes(effort)) {
        return effort;
    }

    const targetRank = EFFORT_RANK[effort];
    let best = supportedRange[0] ?? effort;
    let bestDistance = Math.abs(EFFORT_RANK[best] - targetRank);
    for (const candidate of supportedRange) {
        const distance = Math.abs(EFFORT_RANK[candidate] - targetRank);
        if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
        }
    }

    return best;
}

export function toOpenAIReasoningEffort(
    effort: ReasoningEffort
): 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' {
    return OPENAI_REASONING_EFFORT_MAP[effort];
}
