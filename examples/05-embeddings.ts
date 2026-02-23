import 'dotenv/config';
import { embed } from '@core-ai/core-ai';
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
    const model = openai.embeddingModel('text-embedding-3-small');

    const result = await embed({
        model,
        input: [
            'TypeScript enables safer refactoring.',
            'Runtime validation complements static typing.',
        ],
    });

    console.log('Embedding count:', result.embeddings.length);
    console.log('Vector dimensions:', result.embeddings[0]?.length ?? 0);
    console.log('First vector preview:', result.embeddings[0]?.slice(0, 8));
    console.log('Usage:', result.usage);
}

void main().catch((error: unknown) => {
    if (error instanceof Error) {
        console.error(error.message);
    } else {
        console.error('Unknown error:', error);
    }
    process.exitCode = 1;
});
