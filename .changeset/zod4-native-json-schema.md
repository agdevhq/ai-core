---
'@core-ai/core-ai': minor
'@core-ai/anthropic': minor
'@core-ai/openai': minor
'@core-ai/mistral': minor
'@core-ai/google-genai': minor
---

**Breaking:** Require Zod 4 (`^4.0.0`) and replace `zod-to-json-schema` with Zod 4's native `z.toJSONSchema()`. The `zod-to-json-schema` library produced empty JSON schemas for Zod 4 schemas, breaking tool parameter conversion. A new `zodSchemaToJsonSchema` utility is exported from `@core-ai/core-ai` for consumers that need direct Zod-to-JSON-Schema conversion.
