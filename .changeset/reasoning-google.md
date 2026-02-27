---
'@core-ai/google-genai': minor
---

Add reasoning support for Google GenAI models. Maps unified `reasoning.effort` to `thinkingLevel` for Gemini 3 or `thinkingBudget` for Gemini 2.5 based on model capabilities. Extracts thought content with thought signature preservation for multi-turn fidelity. Automatically enables `includeThoughts` when reasoning is configured.
