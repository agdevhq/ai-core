import { describe, expect, it } from 'vitest';
import {
    getAnthropicModelCapabilities,
    normalizeModelId,
    toAnthropicAdaptiveEffort,
    toAnthropicManualBudget,
} from './model-capabilities.js';

describe('normalizeModelId', () => {
    it('should strip date suffixes', () => {
        expect(normalizeModelId('claude-opus-4-6-20260215')).toBe(
            'claude-opus-4-6'
        );
    });
});

describe('getAnthropicModelCapabilities', () => {
    it('should resolve explicit model capabilities', () => {
        const capabilities = getAnthropicModelCapabilities('claude-opus-4-6');
        expect(capabilities.reasoning.thinkingMode).toBe('adaptive');
        expect(capabilities.reasoning.supportsMaxEffort).toBe(true);
    });

    it('should fallback to defaults for unknown models', () => {
        const capabilities = getAnthropicModelCapabilities('claude-future-5');
        expect(capabilities.reasoning.thinkingMode).toBe('adaptive');
    });
});

describe('effort mapping', () => {
    it('should map adaptive max based on model support', () => {
        expect(toAnthropicAdaptiveEffort('max', true)).toBe('max');
        expect(toAnthropicAdaptiveEffort('max', false)).toBe('high');
    });

    it('should map adaptive minimal to low', () => {
        expect(toAnthropicAdaptiveEffort('minimal', false)).toBe('low');
    });

    it('should map manual budgets', () => {
        expect(toAnthropicManualBudget('minimal')).toBe(1024);
        expect(toAnthropicManualBudget('max')).toBe(65536);
    });
});
