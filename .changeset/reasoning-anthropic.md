---
'@core-ai/anthropic': minor
---

Add reasoning support for Anthropic models with adaptive and manual thinking modes. Maps unified `reasoning.effort` to adaptive effort levels or manual `budget_tokens` based on model capabilities. Extracts thinking and redacted thinking blocks with signature preservation for multi-turn fidelity. Validates parameter restrictions (temperature, top_k, topP, forced toolChoice) and sends interleaved-thinking beta header when reasoning is combined with tools.
