---
'@core-ai/core-ai': minor
---

Add unified reasoning/thinking support with effort-based configuration.

BREAKING CHANGES:
- `AssistantMessage`: `content` and `toolCalls` fields replaced by `parts: AssistantContentPart[]` array
- `StreamEvent`: `content-delta` renamed to `text-delta`, new `reasoning-start`, `reasoning-delta`, `reasoning-end` events added
- `GenerateResult`: adds required `parts` and `reasoning` fields

New types: `ReasoningEffort`, `ReasoningConfig`, `AssistantContentPart`, `ReasoningPart`
New utilities: `resultToMessage()` for multi-turn reasoning state preservation, `assistantMessage()` for convenient message construction
New option: `reasoning?: ReasoningConfig` on `GenerateOptions`, `GenerateObjectOptions`, `StreamObjectOptions`
