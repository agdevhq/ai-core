import type { z } from 'zod';

export class LLMError extends Error {
    public readonly cause?: unknown;

    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = 'LLMError';
        this.cause = cause;
    }
}

export class ProviderError extends LLMError {
    public readonly provider: string;
    public readonly statusCode?: number;

    constructor(
        message: string,
        provider: string,
        statusCode?: number,
        cause?: unknown
    ) {
        super(message, cause);
        this.name = 'ProviderError';
        this.provider = provider;
        this.statusCode = statusCode;
    }
}

export type StructuredOutputValidationErrorOptions = {
    rawText?: string;
    issues: z.ZodIssue[];
    provider: string;
    modelId: string;
    cause?: unknown;
};

export class StructuredOutputValidationError extends LLMError {
    public readonly rawText?: string;
    public readonly issues: z.ZodIssue[];
    public readonly provider: string;
    public readonly modelId: string;

    constructor(
        message: string,
        options: StructuredOutputValidationErrorOptions
    ) {
        super(message, options.cause);
        this.name = 'StructuredOutputValidationError';
        this.rawText = options.rawText;
        this.issues = options.issues;
        this.provider = options.provider;
        this.modelId = options.modelId;
    }
}
