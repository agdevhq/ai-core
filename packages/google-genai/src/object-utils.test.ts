import { describe, expect, it } from 'vitest';

import { asObject } from './object-utils.js';

describe('asObject', () => {
    it('returns the original object when value is a plain object', () => {
        expect(asObject({ key: 'value' })).toEqual({ key: 'value' });
    });

    it('returns an empty object for arrays, null, and primitives', () => {
        expect(asObject(['value'])).toEqual({});
        expect(asObject(null)).toEqual({});
        expect(asObject('value')).toEqual({});
    });
});
