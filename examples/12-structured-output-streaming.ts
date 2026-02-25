import 'dotenv/config';
import { streamObject } from '@core-ai/core-ai';
import { createOpenAI } from '@core-ai/openai';
import { z } from 'zod';

function getRequiredEnv(name: 'OPENAI_API_KEY'): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const weatherSchema = z.object({
    city: z.string(),
    unit: z.enum(['celsius', 'fahrenheit']),
    temperature: z.number(),
    condition: z.string(),
});

async function main(): Promise<void> {
    const openai = createOpenAI({ apiKey: getRequiredEnv('OPENAI_API_KEY') });
    const model = openai.chatModel('gpt-5-mini');

    const result = await streamObject({
        model,
        messages: [
            {
                role: 'user',
                content:
                    'Return weather data for Berlin as JSON with city, unit, temperature, and condition.',
            },
        ],
        schema: weatherSchema,
        schemaName: 'weather_response',
    });

    console.log('Streaming JSON:\n');
    for await (const event of result) {
        if (event.type === 'json-delta') {
            process.stdout.write(event.text);
            continue;
        }

        if (event.type === 'object-delta') {
            process.stdout.write('\n\nObject delta:\n');
            process.stdout.write(`${JSON.stringify(event.partial)}\n`);
        }
    }

    const response = await result.toResponse();
    console.log('\nFinal typed object:\n', response.object);
}

void main().catch((error: unknown) => {
    if (error instanceof Error) {
        console.error(error.message);
    } else {
        console.error('Unknown error:', error);
    }
    process.exitCode = 1;
});
