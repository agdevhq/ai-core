import { describe, expect, it, vi } from 'vitest';

import { callModelWithOptions } from './model-options.ts';

describe('callModelWithOptions', () => {
    it('passes the model and omits it from delegated options', async () => {
        const model = { name: 'test-model' };
        const call = vi.fn(async () => 'ok');

        await callModelWithOptions(
            {
                model,
                prompt: 'hello',
                maxTokens: 42,
            },
            call
        );

        expect(call).toHaveBeenCalledWith(model, {
            prompt: 'hello',
            maxTokens: 42,
        });
    });
});
