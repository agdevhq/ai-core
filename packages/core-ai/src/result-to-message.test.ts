import { describe, expect, it } from 'vitest';
import { assistantMessage, resultToMessage } from './result-to-message.ts';
import type { GenerateResult } from './types.ts';

function createGenerateResult(): GenerateResult {
    return {
        parts: [
            { type: 'reasoning', text: 'Reasoning' },
            { type: 'text', text: 'Answer' },
            {
                type: 'tool-call',
                toolCall: {
                    id: 'tool-1',
                    name: 'search',
                    arguments: { q: 'hello' },
                },
            },
        ],
        content: 'Answer',
        reasoning: 'Reasoning',
        toolCalls: [
            {
                id: 'tool-1',
                name: 'search',
                arguments: { q: 'hello' },
            },
        ],
        finishReason: 'stop',
        usage: {
            inputTokens: 1,
            outputTokens: 1,
            inputTokenDetails: {
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
            },
            outputTokenDetails: {
                reasoningTokens: 0,
            },
        },
    };
}

describe('resultToMessage', () => {
    it('should include reasoning by default', () => {
        const message = resultToMessage(createGenerateResult());

        expect(message).toEqual({
            role: 'assistant',
            parts: [
                { type: 'reasoning', text: 'Reasoning' },
                { type: 'text', text: 'Answer' },
                {
                    type: 'tool-call',
                    toolCall: {
                        id: 'tool-1',
                        name: 'search',
                        arguments: { q: 'hello' },
                    },
                },
            ],
        });
    });

    it('should strip reasoning when requested', () => {
        const message = resultToMessage(createGenerateResult(), {
            includeReasoning: false,
        });

        expect(message).toEqual({
            role: 'assistant',
            parts: [
                { type: 'text', text: 'Answer' },
                {
                    type: 'tool-call',
                    toolCall: {
                        id: 'tool-1',
                        name: 'search',
                        arguments: { q: 'hello' },
                    },
                },
            ],
        });
    });
});

describe('assistantMessage', () => {
    it('should build an assistant text message', () => {
        expect(assistantMessage('Hello')).toEqual({
            role: 'assistant',
            parts: [{ type: 'text', text: 'Hello' }],
        });
    });
});
