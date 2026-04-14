# @core-ai/opentelemetry

[![npm](https://img.shields.io/npm/v/@core-ai/opentelemetry.svg)](https://www.npmjs.com/package/@core-ai/opentelemetry)

OpenTelemetry middleware for `@core-ai/core-ai`.

## Installation

```bash
npm install @core-ai/opentelemetry @opentelemetry/api
```

`@opentelemetry/api` is a peer dependency and must be installed alongside this package.

## Usage

```ts
import { generate } from '@core-ai/core-ai';
import { createOpenAI } from '@core-ai/openai';
import { createOtelMiddleware } from '@core-ai/opentelemetry';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = openai.chatModel('gpt-5-mini');

const result = await generate({
    model,
    messages: [{ role: 'user', content: 'Hello!' }],
    middleware: [createOtelMiddleware()],
});
```
