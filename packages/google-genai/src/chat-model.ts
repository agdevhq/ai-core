import { ApiError } from '@google/genai';
import type {
    FinishReason as GoogleFinishReason,
    FunctionCall as GoogleFunctionCall,
    GenerateContentParameters,
    GenerateContentResponse,
    GoogleGenAI,
} from '@google/genai';
import type {
    ChatModel,
    FinishReason,
    GenerateOptions,
    GenerateResult,
    StreamEvent,
    StreamResult,
    ToolCall,
} from '@core-ai/core-ai';
import { ProviderError } from '@core-ai/core-ai';
import { createStreamResult } from './stream-result.js';
import {
    convertMessages,
    convertToolChoice,
    convertTools,
} from './chat-convert.js';

type GoogleGenAIChatClient = {
    models: GoogleGenAI['models'];
};

export function createGoogleGenAIChatModel(
    client: GoogleGenAIChatClient,
    modelId: string
): ChatModel {
    return {
        provider: 'google',
        modelId,
        async generate(options: GenerateOptions): Promise<GenerateResult> {
            try {
                const request = createGenerateRequest(modelId, options);
                const response = await client.models.generateContent(request);
                return mapGenerateResponse(response);
            } catch (error) {
                throw wrapError(error);
            }
        },
        async stream(options: GenerateOptions): Promise<StreamResult> {
            try {
                const request = createGenerateRequest(modelId, options);
                const stream = await client.models.generateContentStream(request);

                return createStreamResult(transformStream(stream));
            } catch (error) {
                throw wrapError(error);
            }
        },
    };
}

function mapGenerateResponse(response: GenerateContentResponse): GenerateResult {
    const toolCalls = parseFunctionCalls(response.functionCalls);
    const finishReason = mapFinishReason(
        response.candidates?.[0]?.finishReason ?? undefined
    );

    if (!response.candidates?.[0]) {
        return {
            content: null,
            toolCalls,
            finishReason: toolCalls.length > 0 ? 'tool-calls' : finishReason,
            usage: mapUsage(response),
        };
    }

    return {
        content: response.text ?? null,
        toolCalls,
        finishReason: toolCalls.length > 0 ? 'tool-calls' : finishReason,
        usage: mapUsage(response),
    };
}

function parseFunctionCalls(calls: GoogleFunctionCall[] | undefined): ToolCall[] {
    if (!calls || calls.length === 0) {
        return [];
    }

    return calls.map((call, index) => mapFunctionCall(call, index));
}

function mapFunctionCall(toolCall: GoogleFunctionCall, index: number): ToolCall {
    return {
        id: toolCall.id ?? `tool-${index}`,
        name: toolCall.name ?? `tool-${index}`,
        arguments: asObject(toolCall.args),
    };
}

function mapFinishReason(reason: GoogleFinishReason | undefined): FinishReason {
    if (reason === 'STOP') {
        return 'stop';
    }
    if (reason === 'MAX_TOKENS') {
        return 'length';
    }
    if (
        reason === 'SAFETY' ||
        reason === 'RECITATION' ||
        reason === 'BLOCKLIST' ||
        reason === 'PROHIBITED_CONTENT' ||
        reason === 'SPII' ||
        reason === 'IMAGE_SAFETY' ||
        reason === 'IMAGE_PROHIBITED_CONTENT' ||
        reason === 'IMAGE_RECITATION'
    ) {
        return 'content-filter';
    }
    return 'unknown';
}

async function* transformStream(
    stream: AsyncIterable<GenerateContentResponse>
): AsyncIterable<StreamEvent> {
    const bufferedToolCalls = new Map<string, ToolCall>();
    let finishReason: FinishReason = 'unknown';
    let sawToolCalls = false;
    let usage: GenerateResult['usage'] = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
    };

    for await (const chunk of stream) {
        usage = mapUsage(chunk, usage);

        if (chunk.text) {
            yield {
                type: 'content-delta',
                text: chunk.text,
            };
        }

        const functionCalls = chunk.functionCalls ?? [];
        if (functionCalls.length > 0) {
            sawToolCalls = true;
            for (const [index, functionCall] of functionCalls.entries()) {
                const mappedCall = mapFunctionCall(functionCall, index);
                const existing = bufferedToolCalls.get(mappedCall.id);
                if (!existing) {
                    bufferedToolCalls.set(mappedCall.id, mappedCall);
                    yield {
                        type: 'tool-call-start',
                        toolCallId: mappedCall.id,
                        toolName: mappedCall.name,
                    };

                    const serializedArguments = JSON.stringify(mappedCall.arguments);
                    if (serializedArguments !== '{}') {
                        yield {
                            type: 'tool-call-delta',
                            toolCallId: mappedCall.id,
                            argumentsDelta: serializedArguments,
                        };
                    }
                    continue;
                }

                const serializedExisting = JSON.stringify(existing.arguments);
                const serializedNext = JSON.stringify(mappedCall.arguments);
                if (serializedExisting !== serializedNext) {
                    bufferedToolCalls.set(mappedCall.id, mappedCall);
                    yield {
                        type: 'tool-call-delta',
                        toolCallId: mappedCall.id,
                        argumentsDelta: serializedNext,
                    };
                }
            }
        }

        const candidateFinishReason = mapFinishReason(
            chunk.candidates?.[0]?.finishReason ?? undefined
        );
        if (candidateFinishReason !== 'unknown') {
            finishReason = candidateFinishReason;
        }
    }

    for (const toolCall of bufferedToolCalls.values()) {
        yield {
            type: 'tool-call-end',
            toolCall,
        };
    }

    if (sawToolCalls && finishReason !== 'content-filter') {
        finishReason = 'tool-calls';
    }

    yield {
        type: 'finish',
        finishReason,
        usage,
    };
}

function createGenerateRequest(
    modelId: string,
    options: GenerateOptions
): GenerateContentParameters {
    const convertedMessages = convertMessages(options.messages);
    const baseRequest: GenerateContentParameters = {
        model: modelId,
        contents: convertedMessages.contents,
        config: {
            ...(convertedMessages.systemInstruction
                ? { systemInstruction: convertedMessages.systemInstruction }
                : {}),
            ...(options.tools && Object.keys(options.tools).length > 0
                ? { tools: convertTools(options.tools) }
                : {}),
            ...(options.toolChoice
                ? { toolConfig: convertToolChoice(options.toolChoice) }
                : {}),
            ...(options.config?.temperature !== undefined
                ? { temperature: options.config.temperature }
                : {}),
            ...(options.config?.maxTokens !== undefined
                ? { maxOutputTokens: options.config.maxTokens }
                : {}),
            ...(options.config?.topP !== undefined
                ? { topP: options.config.topP }
                : {}),
            ...(options.config?.stopSequences
                ? { stopSequences: options.config.stopSequences }
                : {}),
            ...(options.config?.frequencyPenalty !== undefined
                ? { frequencyPenalty: options.config.frequencyPenalty }
                : {}),
            ...(options.config?.presencePenalty !== undefined
                ? { presencePenalty: options.config.presencePenalty }
                : {}),
        },
    };

    const providerOptions = options.providerOptions;
    if (!providerOptions) {
        return baseRequest;
    }

    const providerConfig = asObject(providerOptions['config']);
    return {
        ...baseRequest,
        ...(providerOptions as Partial<GenerateContentParameters>),
        config: {
            ...baseRequest.config,
            ...providerConfig,
        },
    };
}

function mapUsage(
    response: GenerateContentResponse,
    fallback?: GenerateResult['usage']
): GenerateResult['usage'] {
    const inputTokens =
        response.usageMetadata?.promptTokenCount ?? fallback?.inputTokens ?? 0;
    const outputTokens =
        response.usageMetadata?.candidatesTokenCount ?? fallback?.outputTokens ?? 0;
    const totalTokens =
        response.usageMetadata?.totalTokenCount ??
        fallback?.totalTokens ??
        inputTokens + outputTokens;

    return {
        inputTokens,
        outputTokens,
        totalTokens,
    };
}

function asObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function wrapError(error: unknown): ProviderError {
    if (error instanceof ApiError) {
        return new ProviderError(error.message, 'google', error.status, error);
    }

    return new ProviderError(
        error instanceof Error ? error.message : String(error),
        'google',
        undefined,
        error
    );
}
