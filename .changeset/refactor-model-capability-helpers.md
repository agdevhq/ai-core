---
'@core-ai/core-ai': patch
'@core-ai/anthropic': patch
'@core-ai/google-genai': patch
'@core-ai/openai': patch
---

Refactor model capability helper logic by centralizing model ID normalization in `@core-ai/core-ai` and simplifying effort-to-budget mappings in provider packages without changing runtime behavior.
