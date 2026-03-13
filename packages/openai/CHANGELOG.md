# @core-ai/openai

## 0.7.0

### Minor Changes

- 7ed8b49: **Breaking:** Require Zod 4 (`^4.0.0`) and replace `zod-to-json-schema` with Zod 4's native `z.toJSONSchema()`. The `zod-to-json-schema` library produced empty JSON schemas for Zod 4 schemas, breaking tool parameter conversion. A new `zodSchemaToJsonSchema` utility is exported from `@core-ai/core-ai` for consumers that need direct Zod-to-JSON-Schema conversion.

### Patch Changes

- Updated dependencies [7ed8b49]
    - @core-ai/core-ai@0.7.0

## 0.6.1

### Patch Changes

- ccca3e9: Add model capability support for gpt-5.4 and gpt-5.4-pro.
- 2889c04: Refactor OpenAI chat adapter internals to reduce duplicated stream and part-aggregation logic, and consistently report `finishReason: 'tool-calls'` when a function call is emitted from the stream.
- Updated dependencies [3b599ab]
    - @core-ai/core-ai@0.6.1

## 0.6.0

### Minor Changes

- dbe063d: Migrate `@core-ai/openai` default chat models to the OpenAI Responses API and add a `@core-ai/openai/compat` entrypoint for Chat Completions compatibility. This also adds dedicated OpenAI compat E2E coverage and provider-targeted E2E scripts.
- 308a307: Namespace provider options under `openai` key with Zod validation. Responses API generate options: `store`, `serviceTier`, `include`, `parallelToolCalls`, `user`. Compat (Chat Completions) adds `stopSequences`, `frequencyPenalty`, `presencePenalty`, `seed`. Embed options: `encodingFormat`, `user`. Image options: `background`, `moderation`, `outputCompression`, `outputFormat`, `quality`, `responseFormat`, `style`, `user`.
- c6882e4: Update provider streaming adapters to expose replayable stream handles using the new `ChatStream` and `ObjectStream` types.

### Patch Changes

- be5f32a: Refactor adapter internals to remove duplicated request assembly and reasoning stream cleanup logic without changing behavior.
- Updated dependencies [308a307]
- Updated dependencies [dbe063d]
- Updated dependencies [c6882e4]
    - @core-ai/core-ai@0.6.0

## 0.5.1

### Patch Changes

- 6627888: Fix release publish race: remove prepublishOnly to avoid concurrent tsup builds failing to resolve @core-ai/core-ai.
- Updated dependencies [6627888]
    - @core-ai/core-ai@0.5.1

## 0.5.0

### Minor Changes

- b407153: Add reasoning support for OpenAI models (Chat Completions API). Maps unified `reasoning.effort` to `reasoning_effort` with model-aware clamping. Extracts reasoning content from responses and streams. Validates parameter restrictions for GPT-5.1+ models (temperature/topP incompatible with reasoning). Adds model capability registry for effort range and parameter restriction detection.

### Patch Changes

- Updated dependencies [b407153]
    - @core-ai/core-ai@0.5.0

## 0.4.0

### Minor Changes

- 9664af0: Update OpenAI usage mapping to the new nested `ChatUsage` structure.

    OpenAI responses now map cache and reasoning metrics into:
    - `usage.inputTokenDetails.cacheReadTokens` from `prompt_tokens_details.cached_tokens`
    - `usage.outputTokenDetails.reasoningTokens` from `completion_tokens_details.reasoning_tokens`

    `usage.totalTokens` and top-level `usage.reasoningTokens` are no longer returned.

### Patch Changes

- Updated dependencies [9664af0]
    - @core-ai/core-ai@0.4.0

## 0.3.0

### Minor Changes

- 8b1540e: Add first-class structured output support with `generateObject()` and
  `streamObject()` across core and all provider chat models.

    This introduces schema-driven typed object generation, structured output
    streaming events, and standardized structured-output errors while keeping
    provider strategy logic inside provider packages.

### Patch Changes

- Updated dependencies [8b1540e]
- Updated dependencies [5f3df42]
    - @core-ai/core-ai@0.3.0

## 0.2.1

### Patch Changes

- 37e0cc6: Broaden Zod compatibility to support both Zod 3 and Zod 4 across all packages.

    This updates published Zod ranges and raises the minimum `zod-to-json-schema`
    version to one that supports Zod 4, preventing peer dependency conflicts for
    projects already using Zod 4.

- Updated dependencies [37e0cc6]
    - @core-ai/core-ai@0.2.1

## 0.2.0

### Patch Changes

- @core-ai/core-ai@0.2.0
