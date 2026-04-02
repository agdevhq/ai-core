import { trace } from '@opentelemetry/api';
import {
    BasicTracerProvider,
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from './errors.ts';
import { embed } from './embed.ts';
import type { EmbeddingModel } from './types.ts';

describe('embed', () => {
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

    it('should delegate to model.embed', async () => {
        const model: EmbeddingModel = {
            provider: 'test',
            modelId: 'test-embed',
            embed: vi.fn(async () => ({
                embeddings: [[0.1, 0.2]],
                usage: { inputTokens: 3 },
            })),
        };

        const result = await embed({
            model,
            input: 'hello',
        });

        expect(result.embeddings).toEqual([[0.1, 0.2]]);
        expect(model.embed).toHaveBeenCalledWith({
            input: 'hello',
        });
    });

    it('records telemetry and strips telemetry before delegating', async () => {
        const model: EmbeddingModel = {
            provider: 'test',
            modelId: 'test-embed',
            embed: vi.fn(async () => ({
                embeddings: [[0.1, 0.2]],
                usage: { inputTokens: 3 },
            })),
        };

        await embed({
            model,
            input: ['hello', 'world'],
            telemetry: {
                isEnabled: true,
            },
        });

        expect(model.embed).toHaveBeenCalledWith({
            input: ['hello', 'world'],
        });

        const span = exporter.getFinishedSpans()[0];

        expect(span?.name).toBe('embeddings test-embed');
        expect(span?.attributes['gen_ai.provider.name']).toBe('test');
        expect(span?.attributes['gen_ai.usage.input_tokens']).toBe(3);
        expect(span?.attributes['input.value']).toBe(
            JSON.stringify(['hello', 'world'])
        );
    });

    it('should allow embedding results without usage', async () => {
        const model: EmbeddingModel = {
            provider: 'test',
            modelId: 'test-embed',
            embed: vi.fn(async () => ({
                embeddings: [[0.1, 0.2]],
            })),
        };

        const result = await embed({
            model,
            input: 'hello',
        });

        expect(result.embeddings).toEqual([[0.1, 0.2]]);
        expect(result.usage).toBeUndefined();
    });

    it('should throw for empty string input', async () => {
        const model: EmbeddingModel = {
            provider: 'test',
            modelId: 'test-embed',
            embed: vi.fn(async () => ({
                embeddings: [[0.1, 0.2]],
                usage: { inputTokens: 3 },
            })),
        };

        await expect(
            embed({
                model,
                input: '',
            })
        ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw for empty array input', async () => {
        const model: EmbeddingModel = {
            provider: 'test',
            modelId: 'test-embed',
            embed: vi.fn(async () => ({
                embeddings: [[0.1, 0.2]],
                usage: { inputTokens: 3 },
            })),
        };

        await expect(
            embed({
                model,
                input: [],
            })
        ).rejects.toBeInstanceOf(ValidationError);
    });
});
