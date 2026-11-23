# Coding Standards

Rules applied during code review.

## Provider branches reuse the shared JSON request builder

When adding a provider branch to `genOnce()` in `src/studio.js`, build JSON generation requests through the shared `json()` helper. A branch may select a different endpoint or pass extra body fields; it must not re-implement `call()`, `apiErr()`, or `openaiData()` handling.
