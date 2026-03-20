export function normalizeModelId(modelId: string): string {
    return modelId.replace(/-\d{8}$/, '');
}
