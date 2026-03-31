export class CoreAIError extends Error {
    public readonly cause?: unknown;
    public readonly provider?: string;

    constructor(message: string, cause?: unknown, provider?: string) {
        super(message);
        this.name = 'CoreAIError';
        this.cause = cause;
        this.provider = provider;
    }
}

export class ValidationError extends CoreAIError {
    constructor(message: string, cause?: unknown, provider?: string) {
        super(message, cause, provider);
        this.name = 'ValidationError';
    }
}

export class AbortedError extends CoreAIError {
    constructor(cause?: unknown, provider?: string) {
        super('operation aborted', cause, provider);
        this.name = 'AbortedError';
    }
}

export class StreamAbortedError extends AbortedError {
    constructor(cause?: unknown, provider?: string) {
        super(cause, provider);
        this.name = 'StreamAbortedError';
        this.message = 'stream aborted';
    }
}

export class ProviderError extends CoreAIError {
    public readonly statusCode?: number;

    constructor(
        message: string,
        provider: string,
        statusCode?: number,
        cause?: unknown
    ) {
        super(message, cause, provider);
        this.name = 'ProviderError';
        this.statusCode = statusCode;
    }
}

type StructuredOutputErrorOptions = {
    statusCode?: number;
    cause?: unknown;
    rawOutput?: string;
};

export class StructuredOutputError extends CoreAIError {
    public readonly statusCode?: number;
    public readonly rawOutput?: string;

    constructor(
        message: string,
        provider: string,
        options: StructuredOutputErrorOptions = {}
    ) {
        super(message, options.cause, provider);
        this.name = 'StructuredOutputError';
        this.statusCode = options.statusCode;
        this.rawOutput = options.rawOutput;
    }
}

export class StructuredOutputNoObjectGeneratedError extends StructuredOutputError {
    constructor(
        message: string,
        provider: string,
        options: StructuredOutputErrorOptions = {}
    ) {
        super(message, provider, options);
        this.name = 'StructuredOutputNoObjectGeneratedError';
    }
}

export class StructuredOutputParseError extends StructuredOutputError {
    constructor(
        message: string,
        provider: string,
        options: StructuredOutputErrorOptions = {}
    ) {
        super(message, provider, options);
        this.name = 'StructuredOutputParseError';
    }
}

export class StructuredOutputValidationError extends StructuredOutputError {
    public readonly issues: string[];

    constructor(
        message: string,
        provider: string,
        issues: string[],
        options: StructuredOutputErrorOptions = {}
    ) {
        super(message, provider, options);
        this.name = 'StructuredOutputValidationError';
        this.issues = issues;
    }
}
