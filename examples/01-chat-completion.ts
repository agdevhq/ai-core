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
                role: 'system',
                content: 'You are a concise technical assistant.',
            },
            {
                role: 'user',
                content:
                    'Explain what an embedding vector is in one short paragraph.',
            },
        ],
    });

    console.log('Response:\n', result.content);
    console.log('\nUsage:', result.usage);
}

void main().catch((error: unknown) => {
    if (error instanceof Error) {
        console.error(error.message);
    } else {
        console.error('Unknown error:', error);
    }
    process.exitCode = 1;
});
