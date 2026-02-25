---
'@core-ai/core-ai': minor
---

Add first-class structured output APIs to the core package:

- add `generateObject()` for schema-validated object generation
- add `streamObject()` for structured streaming with `json-delta` / `object-delta` events
- add `StructuredOutputValidationError` for schema and JSON validation failures
- export new structured-output types and update docs/examples
