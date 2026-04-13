import { describe, expect, it, vi } from 'vitest';
import { wrapImageModel } from './wrap-image-model.ts';
import type { ImageGenerateResult, ImageModel } from './types.ts';

function createImageResult(base64: string): ImageGenerateResult {
    return {
        images: [{ base64 }],
    };
}

describe('wrapImageModel', () => {
    it('passes through to the original model when no hooks are defined', async () => {
        const generateMock = vi.fn<ImageModel['generate']>(async () =>
            createImageResult('image-1')
        );
        const model: ImageModel = {
            provider: 'test',
            modelId: 'image-model',
            generate: generateMock,
        };
        const wrapped = wrapImageModel({
            model,
            middleware: {},
        });

        await expect(
            wrapped.generate({
                prompt: 'a cat',
            })
        ).resolves.toEqual(createImageResult('image-1'));
        expect(generateMock).toHaveBeenCalledWith({
            prompt: 'a cat',
        });
    });

    it('allows image middleware to modify options and results', async () => {
        const generateMock = vi.fn<ImageModel['generate']>(async (options) =>
            createImageResult(options.prompt)
        );
        const model: ImageModel = {
            provider: 'test',
            modelId: 'image-model',
            generate: generateMock,
        };
        const wrapped = wrapImageModel({
            model,
            middleware: {
                generate: async ({ execute, options }) => {
                    const result = await execute({
                        ...options,
                        prompt: 'rewritten',
                    });

                    return {
                        images: result.images.map((image) => ({
                            ...image,
                            revisedPrompt: 'middleware-added',
                        })),
                    };
                },
            },
        });

        await expect(
            wrapped.generate({
                prompt: 'a cat',
            })
        ).resolves.toEqual({
            images: [
                {
                    base64: 'rewritten',
                    revisedPrompt: 'middleware-added',
                },
            ],
        });
        expect(generateMock).toHaveBeenCalledWith({
            prompt: 'rewritten',
        });
    });
});
