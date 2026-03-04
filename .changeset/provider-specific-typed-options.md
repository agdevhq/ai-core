---
'@core-ai/core-ai': minor
'@core-ai/openai': minor
'@core-ai/anthropic': minor
'@core-ai/mistral': minor
'@core-ai/google-genai': minor
---

Remove `ModelConfig` and flatten universal sampling fields onto generate options (`temperature`, `maxTokens`, `topP`), then migrate provider overrides to provider-namespaced typed objects with per-provider Zod validation. Provider options are now method-specific (`GenerateProviderOptions`, `EmbedProviderOptions`, `ImageProviderOptions`) so generate/embed/image each expose only the relevant provider fields (`openai`, `anthropic`, `mistral`, `google`). Adapters now parse and validate method-specific provider options and reject invalid fields early.
