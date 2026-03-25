import { stripModelDateSuffix } from './model-id.ts';

export function normalizeProviderModelId(modelId: string): string {
    return stripModelDateSuffix(modelId);
}

export function asObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

export function safeParseJsonObject(json: string): Record<string, unknown> {
    try {
        return asObject(JSON.parse(json) as unknown);
    } catch {
        return {};
    }
}
