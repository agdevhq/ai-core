import 'dotenv/config';
import { trace } from '@opentelemetry/api';
import {
    BasicTracerProvider,
    ConsoleSpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { generate, stream } from '@core-ai/core-ai';
import { createOpenAI } from '@core-ai/openai';

function getRequiredEnv(name: 'OPENAI_API_KEY'): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

async function main(): Promise<void> {
    const provider = new BasicTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    });

    trace.setGlobalTracerProvider(provider);
    const openai = createOpenAI({ apiKey: getRequiredEnv('OPENAI_API_KEY') });
    const model = openai.chatModel('gpt-5-mini');

    console.log('Running generate() with content recording enabled...\n');

    try {
        const generateResult = await generate({
            model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a concise assistant.',
                },
                {
                    role: 'user',
                    content:
                        'Explain in one short paragraph what OpenTelemetry spans are.',
                },
            ],
            telemetry: {
                isEnabled: true,
                functionId: 'examples.telemetry.generate',
            },
        });

        console.log('generate() content:\n', generateResult.content);
        console.log();
        console.log('Running stream() with content recording disabled...\n');

        const chatStream = await stream({
            model,
            messages: [
                {
                    role: 'user',
                    content:
                        'Write a two-line poem about traces and telemetry.',
                },
            ],
            telemetry: {
                isEnabled: true,
                functionId: 'examples.telemetry.stream',
                recordContent: false,
            },
        });

        const streamResult = await chatStream.result;
        console.log('\nstream() result:\n', streamResult.content);
        console.log();
    } finally {
        await provider.forceFlush();
        await provider.shutdown();
    }
}

void main().catch((error: unknown) => {
    if (error instanceof Error) {
        console.error(error.message);
    } else {
        console.error('Unknown error:', error);
    }
    process.exitCode = 1;
});
