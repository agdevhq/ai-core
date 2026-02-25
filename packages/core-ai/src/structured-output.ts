import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { LLMError, StructuredOutputValidationError } from './errors.ts';
import type {
    GenerateOptions,
    GenerateResult,
    StructuredMode,
} from './types.ts';

export type StructuredStrategy = 'native' | 'tool' | 'json';

export type StructuredPlan = {
    strategy: StructuredStrategy;
    schemaToolName: string;
    options: GenerateOptions;
};

export type ExtractStructuredValueParams = {
    result: GenerateResult;
    strategy: StructuredStrategy;
    schemaToolName: string;
    provider: string;
    modelId: string;
};

const DEFAULT_SCHEMA_NAME = 'response';

export function prepareStructuredGenerateOptions<TSchema extends z.ZodTypeAny>(params: {
    provider: string;
    schema: TSchema;
    mode: StructuredMode | undefined;
    schemaName: string | undefined;
    schemaDescription: string | undefined;
    options: GenerateOptions;
}): StructuredPlan {
    assertNoUserTools(params.options);

    const resolvedSchemaName = resolveSchemaName(params.schemaName);
    const schemaToolName = `return_${resolvedSchemaName}`;
    const schemaJson = removeMetaSchema(
        zodToJsonSchema(params.schema) as Record<string, unknown>
    );
    const strategy = resolveStructuredStrategy(params.provider, params.mode);

    if (strategy === 'tool') {
        return {
            strategy,
            schemaToolName,
            options: {
                ...params.options,
                tools: {
                    [schemaToolName]: {
                        name: schemaToolName,
                        description:
                            params.schemaDescription ??
                            `Return a JSON object for ${resolvedSchemaName}`,
                        parameters: params.schema,
                    },
                },
                toolChoice: {
                    type: 'tool',
                    toolName: schemaToolName,
                },
            },
        };
    }

    const providerOptions = mergeProviderOptions(
        params.options.providerOptions,
        strategy === 'native'
            ? createNativeProviderOptions(
                  params.provider,
                  resolvedSchemaName,
                  params.schemaDescription,
                  schemaJson
              )
            : createJsonProviderOptions(params.provider)
    );

    if (strategy === 'native') {
        return {
            strategy,
            schemaToolName,
            options: {
                ...params.options,
                providerOptions,
            },
        };
    }

    return {
        strategy,
        schemaToolName,
        options: {
            ...params.options,
            messages: [
                {
                    role: 'system',
                    content: createJsonModeInstruction(
                        resolvedSchemaName,
                        params.schemaDescription,
                        schemaJson
                    ),
                },
                ...params.options.messages,
            ],
            providerOptions,
        },
    };
}

export function resolveStructuredStrategy(
    provider: string,
    mode: StructuredMode | undefined
): StructuredStrategy {
    const requestedMode = mode ?? 'auto';
    if (requestedMode === 'tool') {
        return 'tool';
    }
    if (requestedMode === 'json') {
        return 'json';
    }
    if (requestedMode === 'native') {
        if (provider !== 'openai' && provider !== 'google') {
            throw new LLMError(
                `Structured mode "native" is not supported for provider "${provider}"`
            );
        }
        return 'native';
    }

    if (provider === 'openai' || provider === 'google') {
        return 'native';
    }
    if (provider === 'anthropic') {
        return 'tool';
    }
    return 'json';
}

export function extractStructuredValue(
    params: ExtractStructuredValueParams
): { value: unknown; rawText?: string } {
    if (params.strategy === 'tool') {
        const matchingToolCall =
            params.result.toolCalls.find(
                (toolCall) => toolCall.name === params.schemaToolName
            ) ?? params.result.toolCalls[0];

        if (matchingToolCall) {
            return {
                value: matchingToolCall.arguments,
                rawText: safeStringify(matchingToolCall.arguments),
            };
        }
    }

    const content = params.result.content;
    if (!content || content.trim().length === 0) {
        throw new StructuredOutputValidationError(
            'Model returned no JSON content for structured output',
            {
                provider: params.provider,
                modelId: params.modelId,
                issues: [],
            }
        );
    }

    return {
        value: parseJsonText(content, params.provider, params.modelId),
        rawText: content,
    };
}

export function parseJsonText(
    rawText: string,
    provider: string,
    modelId: string
): unknown {
    const normalized = normalizeJsonText(rawText);

    try {
        return JSON.parse(normalized) as unknown;
    } catch (cause) {
        throw new StructuredOutputValidationError(
            'Model returned invalid JSON for structured output',
            {
                rawText,
                issues: [],
                provider,
                modelId,
                cause,
            }
        );
    }
}

export function tryParseJsonText(rawText: string): unknown | undefined {
    const normalized = normalizeJsonText(rawText);
    if (normalized.length === 0) {
        return undefined;
    }

    try {
        return JSON.parse(normalized) as unknown;
    } catch {
        return undefined;
    }
}

export function validateStructuredValue<TSchema extends z.ZodTypeAny>(params: {
    schema: TSchema;
    value: unknown;
    rawText: string | undefined;
    provider: string;
    modelId: string;
}): z.infer<TSchema> {
    const parsed = params.schema.safeParse(params.value);
    if (parsed.success) {
        return parsed.data;
    }

    throw new StructuredOutputValidationError(
        'Model output did not match the provided schema',
        {
            rawText: params.rawText,
            issues: parsed.error.issues,
            provider: params.provider,
            modelId: params.modelId,
        }
    );
}

export function safeStringify(value: unknown): string | undefined {
    try {
        return JSON.stringify(value);
    } catch {
        return undefined;
    }
}

function assertNoUserTools(options: GenerateOptions): void {
    if (options.tools && Object.keys(options.tools).length > 0) {
        throw new LLMError(
            'generateObject/streamObject does not support user-defined tools'
        );
    }

    if (options.toolChoice) {
        throw new LLMError(
            'generateObject/streamObject does not support toolChoice'
        );
    }
}

function resolveSchemaName(schemaName: string | undefined): string {
    const base =
        schemaName && schemaName.trim().length > 0
            ? schemaName.trim()
            : DEFAULT_SCHEMA_NAME;
    const normalized = base
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/^[^a-zA-Z_]+/, '_');
    return normalized.length > 0 ? normalized : DEFAULT_SCHEMA_NAME;
}

function createNativeProviderOptions(
    provider: string,
    schemaName: string,
    schemaDescription: string | undefined,
    schema: Record<string, unknown>
): Record<string, unknown> {
    if (provider === 'openai') {
        return {
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: schemaName,
                    ...(schemaDescription
                        ? { description: schemaDescription }
                        : {}),
                    strict: true,
                    schema,
                },
            },
        };
    }

    if (provider === 'google') {
        return {
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        };
    }

    throw new LLMError(
        `Structured mode "native" is not supported for provider "${provider}"`
    );
}

function createJsonProviderOptions(
    provider: string
): Record<string, unknown> | undefined {
    if (provider === 'openai') {
        return {
            response_format: {
                type: 'json_object',
            },
        };
    }

    if (provider === 'google') {
        return {
            config: {
                responseMimeType: 'application/json',
            },
        };
    }

    if (provider === 'mistral') {
        return {
            responseFormat: {
                type: 'json_object',
            },
        };
    }

    return undefined;
}

function mergeProviderOptions(
    existing: Record<string, unknown> | undefined,
    injected: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
    if (!existing) {
        return injected;
    }
    if (!injected) {
        return existing;
    }

    const merged: Record<string, unknown> = {
        ...existing,
        ...injected,
    };

    const existingConfig = asRecord(existing['config']);
    const injectedConfig = asRecord(injected['config']);
    if (existingConfig || injectedConfig) {
        merged['config'] = {
            ...(existingConfig ?? {}),
            ...(injectedConfig ?? {}),
        };
    }

    return merged;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return undefined;
}

function removeMetaSchema(
    schema: Record<string, unknown>
): Record<string, unknown> {
    const { $schema: _schema, ...rest } = schema;
    return rest;
}

function createJsonModeInstruction(
    schemaName: string,
    schemaDescription: string | undefined,
    schema: Record<string, unknown>
): string {
    const schemaDescriptionLine = schemaDescription
        ? `Description: ${schemaDescription}`
        : undefined;

    return [
        `Respond with JSON that matches the "${schemaName}" schema.`,
        schemaDescriptionLine,
        'Do not include markdown, code fences, or explanatory text.',
        'JSON Schema:',
        JSON.stringify(schema),
    ]
        .filter((line): line is string => Boolean(line))
        .join('\n');
}

function normalizeJsonText(rawText: string): string {
    const trimmed = rawText.trim();
    if (!trimmed.startsWith('```')) {
        return trimmed;
    }

    const withoutOpeningFence = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/u, '');
    const withoutClosingFence = withoutOpeningFence.replace(/\s*```$/u, '');
    return withoutClosingFence.trim();
}
