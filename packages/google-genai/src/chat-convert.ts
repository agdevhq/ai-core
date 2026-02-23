import {
    FunctionCallingConfigMode,
    type Content,
    type FunctionDeclaration,
    type Part,
    type Tool,
    type ToolConfig,
} from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
    Message,
    ToolChoice,
    ToolSet,
    UserContentPart,
} from '@core-ai/core-ai';

export type ConvertedGoogleMessages = {
    contents: Content[];
    systemInstruction?: string;
};

export function convertMessages(messages: Message[]): ConvertedGoogleMessages {
    const systemParts: string[] = [];
    const contents: Content[] = [];
    const toolCallNameById = new Map<string, string>();

    for (const message of messages) {
        if (message.role === 'system') {
            systemParts.push(message.content);
            continue;
        }

        if (message.role === 'user') {
            const userParts: Part[] =
                typeof message.content === 'string'
                    ? [{ text: message.content }]
                    : message.content.map(convertUserContentPart);

            contents.push({
                role: 'user',
                parts: userParts,
            });
            continue;
        }

        if (message.role === 'assistant') {
            const assistantParts: Part[] = [];

            if (message.content) {
                assistantParts.push({ text: message.content });
            }

            for (const toolCall of message.toolCalls ?? []) {
                toolCallNameById.set(toolCall.id, toolCall.name);
                assistantParts.push({
                    functionCall: {
                        id: toolCall.id,
                        name: toolCall.name,
                        args: toolCall.arguments,
                    },
                });
            }

            contents.push({
                role: 'model',
                parts: assistantParts.length > 0 ? assistantParts : [{ text: '' }],
            });
            continue;
        }

        const functionName =
            toolCallNameById.get(message.toolCallId) ?? message.toolCallId;
        const response = message.isError
            ? { error: message.content }
            : { output: message.content };
        const toolResponsePart: Part = {
            functionResponse: {
                id: message.toolCallId,
                name: functionName,
                response,
            },
        };

        const lastContent = contents.at(-1);
        if (lastContent && isToolResultContent(lastContent)) {
            lastContent.parts?.push(toolResponsePart);
            continue;
        }

        contents.push({
            role: 'user',
            parts: [toolResponsePart],
        });
    }

    return {
        contents,
        systemInstruction: systemParts.length > 0 ? systemParts.join('\n') : undefined,
    };
}

function convertUserContentPart(part: UserContentPart): Part {
    if (part.type === 'text') {
        return { text: part.text };
    }

    if (part.type === 'image') {
        if (part.source.type === 'url') {
            return {
                fileData: {
                    fileUri: part.source.url,
                    mimeType: inferMimeTypeFromUrl(part.source.url),
                },
            };
        }

        return {
            inlineData: {
                data: part.source.data,
                mimeType: part.source.mediaType,
            },
        };
    }

    return {
        inlineData: {
            data: part.data,
            mimeType: part.mimeType,
        },
    };
}

export function convertTools(tools: ToolSet): Tool[] {
    const functionDeclarations: FunctionDeclaration[] = Object.values(tools).map(
        (tool) => {
            const schema = zodToJsonSchema(tool.parameters) as Record<
                string,
                unknown
            >;
            const { $schema: _schema, ...parametersJsonSchema } = schema;

            return {
                name: tool.name,
                description: tool.description,
                parametersJsonSchema,
            };
        }
    );

    if (functionDeclarations.length === 0) {
        return [];
    }

    return [
        {
            functionDeclarations,
        },
    ];
}

export function convertToolChoice(choice: ToolChoice): ToolConfig {
    if (choice === 'auto') {
        return {
            functionCallingConfig: {
                mode: FunctionCallingConfigMode.AUTO,
            },
        };
    }
    if (choice === 'none') {
        return {
            functionCallingConfig: {
                mode: FunctionCallingConfigMode.NONE,
            },
        };
    }
    if (choice === 'required') {
        return {
            functionCallingConfig: {
                mode: FunctionCallingConfigMode.ANY,
            },
        };
    }

    return {
        functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: [choice.toolName],
        },
    };
}

function isToolResultContent(content: Content): boolean {
    if (content.role !== 'user' || !content.parts || content.parts.length === 0) {
        return false;
    }

    return content.parts.every((part) => part.functionResponse);
}

function inferMimeTypeFromUrl(url: string): string {
    const normalized = url.toLowerCase();
    if (normalized.endsWith('.png')) {
        return 'image/png';
    }
    if (normalized.endsWith('.webp')) {
        return 'image/webp';
    }
    if (normalized.endsWith('.gif')) {
        return 'image/gif';
    }
    if (normalized.endsWith('.svg')) {
        return 'image/svg+xml';
    }
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    return 'application/octet-stream';
}
