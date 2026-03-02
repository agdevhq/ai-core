---
'@core-ai/openai': minor
---

Add reasoning support for OpenAI models (Chat Completions API). Maps unified `reasoning.effort` to `reasoning_effort` with model-aware clamping. Extracts reasoning content from responses and streams. Validates parameter restrictions for GPT-5.1+ models (temperature/topP incompatible with reasoning). Adds model capability registry for effort range and parameter restriction detection.
