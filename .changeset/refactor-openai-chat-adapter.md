---
'@core-ai/openai': patch
---

Refactor OpenAI chat adapter internals to reduce duplicated stream and part-aggregation logic, and consistently report `finishReason: 'tool-calls'` when a function call is emitted from the stream.
