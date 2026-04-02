import { trace } from '@opentelemetry/api';
import {
    BasicTracerProvider,
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from './errors.ts';
import { generateImage } from './generate-image.ts';
import type { ImageModel } from './types.ts';

describe('generateImage', () => {
    let exporter: InMemorySpanExporter;
    let provider: BasicTracerProvider;

    beforeEach(() => {
        trace.disable();
        exporter = new InMemorySpanExporter();
        provider = new BasicTracerProvider({
            spanProcessors: [new SimpleSpanProcessor(exporter)],
        });
        trace.setGlobalTracerProvider(provider);
    });

    afterEach(async () => {
        await provider.shutdown();
        trace.disable();
    });

    it('should delegate to model.generate', async () => {
        const model: ImageModel = {
            provider: 'test',
            modelId: 'test-image',
            generate: vi.fn(async () => ({
                images: [{ base64: 'abc' }],
            })),
        };

        const result = await generateImage({
            model,
            prompt: 'a cat',
        });

        expect(result.images).toEqual([{ base64: 'abc' }]);
        expect(model.generate).toHaveBeenCalledWith({
            prompt: 'a cat',
        });
    });

    it('records telemetry and strips telemetry before delegating', async () => {
        const model: ImageModel = {
            provider: 'test',
            modelId: 'test-image',
            generate: vi.fn(async () => ({
                images: [{ base64: 'abc' }],
            })),
        };

        await generateImage({
            model,
            prompt: 'a cat',
            telemetry: {
                isEnabled: true,
            },
        });

        expect(model.generate).toHaveBeenCalledWith({
            prompt: 'a cat',
        });

        const span = exporter.getFinishedSpans()[0];

        expect(span?.name).toBe('image_generation test-image');
        expect(span?.attributes['gen_ai.provider.name']).toBe('test');
        expect(span?.attributes['gen_ai.output.type']).toBe('image');
        expect(span?.attributes['input.value']).toBe('a cat');
    });

    it('should throw for empty prompt', async () => {
        const model: ImageModel = {
            provider: 'test',
            modelId: 'test-image',
            generate: vi.fn(async () => ({ images: [] })),
        };

        await expect(
            generateImage({
                model,
                prompt: '',
            })
        ).rejects.toBeInstanceOf(ValidationError);
    });
});
