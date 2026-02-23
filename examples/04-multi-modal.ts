import 'dotenv/config';
import { generate } from '@core-ai/core-ai';
import { createOpenAI } from '@core-ai/openai';

function getRequiredEnv(name: 'OPENAI_API_KEY'): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

async function main(): Promise<void> {
    const openai = createOpenAI({ apiKey: getRequiredEnv('OPENAI_API_KEY') });
    const model = openai.chatModel('gpt-5-mini');

    const result = await generate({
        model,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'What do you see in this image?' },
                    {
                        type: 'image',
                        source: {
                            type: 'url',
                            url: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg',
                        },
                    },
                ],
            },
        ],
    });

    console.log('Model description:\n', result.content);
}

void main().catch((error: unknown) => {
    if (error instanceof Error) {
        console.error(error.message);
    } else {
        console.error('Unknown error:', error);
    }
    process.exitCode = 1;
});
