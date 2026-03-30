import { ValidationError } from './errors.ts';
import type { Message } from './types.ts';

function isEmptyText(value: string): boolean {
    return value.length === 0;
}

export function assertNonEmptyMessages(messages: Message[]): void {
    if (messages.length === 0) {
        throw new ValidationError('messages must not be empty');
    }
}

export function assertNonEmptyEmbedInput(input: string | string[]): void {
    const isEmptyString = typeof input === 'string' && isEmptyText(input);
    const isEmptyArray = Array.isArray(input) && input.length === 0;
    if (isEmptyString || isEmptyArray) {
        throw new ValidationError('input must not be empty');
    }
}

export function assertNonEmptyPrompt(prompt: string): void {
    if (isEmptyText(prompt)) {
        throw new ValidationError('prompt must not be empty');
    }
}
