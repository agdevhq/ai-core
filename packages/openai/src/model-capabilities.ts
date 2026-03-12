import type { ReasoningEffort } from '@core-ai/core-ai';

export type OpenAIModelCapabilities = {
    reasoning: {
        supportsEffort: boolean;
        supportedRange: readonly ReasoningEffort[];
        restrictsSamplingParams: boolean;
    };
};

const RANGE_LOW_TO_HIGH = ['low', 'medium', 'high'] as const;
const RANGE_LOW_TO_MAX = ['low', 'medium', 'high', 'max'] as const;
const RANGE_MINIMAL_TO_HIGH = ['minimal', 'low', 'medium', 'high'] as const;

function createReasoningCapabilities(
    supportedRange: readonly ReasoningEffort[],
    restrictsSamplingParams: boolean,
    supportsEffort = true
): OpenAIModelCapabilities {
    return {
        reasoning: {
            supportsEffort,
            supportedRange,
            restrictsSamplingParams,
        },
    };
}

const DEFAULT_CAPABILITIES = createReasoningCapabilities(
    RANGE_LOW_TO_HIGH,
    false
);

const MODEL_CAPABILITIES: Record<string, OpenAIModelCapabilities> = {
    'gpt-5.4': createReasoningCapabilities(RANGE_LOW_TO_MAX, true),
    'gpt-5.4-pro': createReasoningCapabilities(RANGE_LOW_TO_MAX, true),
    'gpt-5.2': createReasoningCapabilities(RANGE_LOW_TO_MAX, true),
    'gpt-5.2-codex': createReasoningCapabilities(RANGE_LOW_TO_MAX, true),
    'gpt-5.2-pro': createReasoningCapabilities(RANGE_LOW_TO_MAX, true),
    'gpt-5.1': createReasoningCapabilities(RANGE_LOW_TO_HIGH, true),
    'gpt-5': createReasoningCapabilities(RANGE_MINIMAL_TO_HIGH, true),
    'gpt-5-mini': createReasoningCapabilities(RANGE_MINIMAL_TO_HIGH, true),
    'gpt-5-nano': createReasoningCapabilities(RANGE_MINIMAL_TO_HIGH, true),
    o3: createReasoningCapabilities(RANGE_LOW_TO_HIGH, false),
    'o3-mini': createReasoningCapabilities(RANGE_LOW_TO_HIGH, false),
    'o4-mini': createReasoningCapabilities(RANGE_LOW_TO_HIGH, false),
    o1: createReasoningCapabilities(RANGE_LOW_TO_HIGH, false),
    'o1-mini': createReasoningCapabilities([], false, false),
};

const EFFORT_RANK: Record<ReasoningEffort, number> = {
    minimal: 0,
    low: 1,
    medium: 2,
    high: 3,
    max: 4,
};

export function getOpenAIModelCapabilities(
    modelId: string
): OpenAIModelCapabilities {
    const normalizedModelId = normalizeModelId(modelId);
    return MODEL_CAPABILITIES[normalizedModelId] ?? DEFAULT_CAPABILITIES;
}

export function normalizeModelId(modelId: string): string {
    return modelId.replace(/-\d{8}$/, '');
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
    if (effort === 'max') {
        return 'xhigh';
    }
    return effort;
}
