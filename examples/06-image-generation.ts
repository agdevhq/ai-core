import 'dotenv/config';
import { generateImage } from '@core-ai/core-ai';
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
    const model = openai.imageModel('gpt-image-1');

    const result = await generateImage({
        model,
        prompt: 'A watercolor painting of a robot coding in a quiet mountain cabin at sunrise',
        n: 1,
        size: '1024x1024',
    });

    for (const [index, image] of result.images.entries()) {
        console.log(`Image ${index + 1}:`);
        if (image.url) {
            console.log('URL:', image.url);
        } else if (image.base64) {
            console.log('Base64 preview:', image.base64.slice(0, 80), '...');
        } else {
            console.log('No image payload found.');
        }
        if (image.revisedPrompt) {
            console.log('Revised prompt:', image.revisedPrompt);
        }
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
