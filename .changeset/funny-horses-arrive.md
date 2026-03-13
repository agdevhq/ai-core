---
'@core-ai/core-ai': patch
'@core-ai/openai': patch
'@core-ai/google-genai': patch
---

Refactor internal adapter and stream plumbing for readability by removing duplicated transition code, consolidating model parameter handling, and deleting an unused function parameter without changing runtime behavior.
