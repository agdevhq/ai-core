---
'@core-ai/langfuse': patch
---

Fix double-counting of cache and reasoning tokens in Langfuse usage breakdown. The `input` and `output` keys now report only non-overlapping token counts so Langfuse's aggregation sums correctly.
