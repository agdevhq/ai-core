import 'dotenv/config';
import { generate } from '@core-ai/core-ai';
import { createOmnifact } from '@core-ai/omnifact';

function getRequiredEnv(name: 'OMNIFACT_API_KEY'): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

async function main(): Promise<void> {
    const omnifact = createOmnifact({
        apiKey: getRequiredEnv('OMNIFACT_API_KEY'),
        // Default: https://connect.omnifact.ai/v1/gateway
        // For local dev against the Omnifact public API:
        // baseURL: 'http://localhost:3001/v1/gateway',
    });
    const model = omnifact.chatModel('gpt-5-mini');

    const result = await generate({
        model,
        messages: [
            {
                role: 'user',
                content:
                    'Explain why composable provider abstractions improve AI application portability in one paragraph.',
            },
        ],
        maxTokens: 256,
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
