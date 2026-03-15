---
'@core-ai/core-ai': patch
'@core-ai/openai': patch
'@core-ai/google-genai': patch
'@core-ai/anthropic': patch
'@core-ai/mistral': patch
---

Refactor provider internals to reuse shared model-id and JSON object parsing utilities, simplify effort budget mappings, and add missing object-utils test coverage in Google GenAI.
