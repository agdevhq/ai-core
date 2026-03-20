import { describe, expect, it } from 'vitest';

import { normalizeModelId } from './model-id.ts';

describe('normalizeModelId', () => {
    it('strips an 8-digit date suffix', () => {
        expect(normalizeModelId('gpt-5.2-20260215')).toBe('gpt-5.2');
    });

    it('keeps model IDs without date suffix unchanged', () => {
        expect(normalizeModelId('o4-mini')).toBe('o4-mini');
    });
});
