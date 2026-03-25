const MODEL_DATE_SUFFIX_PATTERN = /-\d{8}$/;

export function stripModelDateSuffix(modelId: string): string {
    return modelId.replace(MODEL_DATE_SUFFIX_PATTERN, '');
}
