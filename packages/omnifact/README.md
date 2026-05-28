# @core-ai/omnifact

[![npm](https://img.shields.io/npm/v/@core-ai/omnifact.svg)](https://www.npmjs.com/package/@core-ai/omnifact)

Omnifact provider package for `@core-ai/core-ai`. Connects to the Omnifact API Gateway, an OpenAI-compatible endpoint for chat completions.

## Installation

```bash
npm install @core-ai/core-ai @core-ai/omnifact zod
```

## Usage

```ts
import { generate } from '@core-ai/core-ai';
import { createOmnifact } from '@core-ai/omnifact';

const omnifact = createOmnifact({
    apiKey: process.env.OMNIFACT_API_KEY,
});

const model = omnifact.chatModel('gpt-5-mini');

const result = await generate({
    model,
    messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(result.content);
```

By default, requests go to `https://connect.omnifact.ai/v1/gateway`. Override for local development:

```ts
const omnifact = createOmnifact({
    apiKey: process.env.OMNIFACT_API_KEY,
    baseURL: 'http://localhost:3001/v1/gateway',
});
```

Use your Omnifact organization API key as the `apiKey`.
