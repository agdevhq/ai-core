import type {
    AssistantContentPart,
    GenerateResult,
    StreamEvent,
    ChatStream,
} from './types.ts';
import { createStream } from './base-stream.ts';

export function createChatStream(
    source:
        | AsyncIterable<StreamEvent>
        | (() => Promise<AsyncIterable<StreamEvent>>),
    options: {
        signal?: AbortSignal;
    } = {}
): ChatStream {
    const { signal } = options;
    const resolvedSource: AsyncIterable<StreamEvent> =
        typeof source === 'function'
            ? (async function* () {
                  yield* await source();
              })()
            : source;
    const parts: AssistantContentPart[] = [];
    let textBuffer = '';
    let reasoningBuffer = '';
    let reasoningProviderMetadata:
        | Record<string, Record<string, unknown>>
        | undefined;
    let insideReasoning = false;
    let finishReason: GenerateResult['finishReason'] = 'unknown';
    let usage: GenerateResult['usage'] = {
        inputTokens: 0,
        outputTokens: 0,
        inputTokenDetails: {
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
        },
        outputTokenDetails: {},
    };

    const flushText = () => {
        if (textBuffer.length === 0) {
            return;
        }
        parts.push({
            type: 'text',
            text: textBuffer,
        });
        textBuffer = '';
    };

    const flushReasoning = () => {
        if (
            reasoningBuffer.length === 0 &&
            reasoningProviderMetadata === undefined
        ) {
            return;
        }
        parts.push({
            type: 'reasoning',
            text: reasoningBuffer,
            ...(reasoningProviderMetadata
                ? { providerMetadata: reasoningProviderMetadata }
                : {}),
        });
        reasoningBuffer = '';
        reasoningProviderMetadata = undefined;
    };

    const startReasoning = () => {
        flushText();
        flushReasoning();
        insideReasoning = true;
    };

    const appendReasoning = (text: string) => {
        if (!insideReasoning) {
            flushText();
            insideReasoning = true;
        }
        reasoningBuffer += text;
    };

    const endReasoning = (
        providerMetadata?: Record<string, Record<string, unknown>>
    ) => {
        reasoningProviderMetadata = providerMetadata;
        flushReasoning();
        insideReasoning = false;
    };

    const appendText = (text: string) => {
        if (insideReasoning) {
            flushReasoning();
            insideReasoning = false;
        }
        textBuffer += text;
    };

    const appendToolCall = (
        toolCall: Extract<StreamEvent, { type: 'tool-call-end' }>['toolCall']
    ) => {
        flushText();
        flushReasoning();
        insideReasoning = false;
        parts.push({
            type: 'tool-call',
            toolCall,
        });
    };

    const setFinish = (event: Extract<StreamEvent, { type: 'finish' }>) => {
        finishReason = event.finishReason;
        usage = event.usage;
    };

    return createStream({
        source: resolvedSource,
        signal,
        reduceEvent(event) {
            switch (event.type) {
                case 'reasoning-start':
                    startReasoning();
                    break;
                case 'reasoning-delta':
                    appendReasoning(event.text);
                    break;
                case 'reasoning-end':
                    endReasoning(event.providerMetadata);
                    break;
                case 'text-delta':
                    appendText(event.text);
                    break;
                case 'tool-call-end':
                    appendToolCall(event.toolCall);
                    break;
                case 'finish':
                    setFinish(event);
                    break;
                default:
                    break;
            }
        },
        finalizeResult() {
            flushText();
            flushReasoning();

            const content = parts
                .flatMap((part) => (part.type === 'text' ? [part.text] : []))
                .join('');
            const reasoning = parts
                .flatMap((part) =>
                    part.type === 'reasoning' ? [part.text] : []
                )
                .join('');
            const toolCalls = parts.flatMap((part) =>
                part.type === 'tool-call' ? [part.toolCall] : []
            );

            return {
                parts,
                content: content.length > 0 ? content : null,
                reasoning: reasoning.length > 0 ? reasoning : null,
                toolCalls,
                finishReason,
                usage,
            };
        },
    });
}
