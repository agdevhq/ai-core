import 'dotenv/config';
import { generateObject } from '@core-ai/core-ai';
import { createOpenAI } from '@core-ai/openai';
import { z } from 'zod';

function getRequiredEnv(name: 'OPENAI_API_KEY'): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const personSchema = z.object({
    name: z.string(),
    age: z.number().int().nonnegative(),
    occupation: z.string(),
    skills: z.array(z.string()),
});

async function main(): Promise<void> {
    const openai = createOpenAI({ apiKey: getRequiredEnv('OPENAI_API_KEY') });
    const model = openai.chatModel('gpt-5-mini');

    const result = await generateObject({
        model,
        messages: [
            {
                role: 'user',
                content: 'Return a short profile for Ada Lovelace as JSON.',
            },
        ],
        schema: personSchema,
        schemaName: 'person_profile',
        schemaDescription: 'Short biography summary',
    });

    console.log('Typed object:\n', result.object);
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
