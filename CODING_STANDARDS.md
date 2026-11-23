# Coding Standards

Rules applied during code review.

## Provider branches reuse the shared JSON request builder

When adding a provider branch to `genOnce()` in `src/studio.js`, build JSON generation requests through the shared `json()` helper. A branch may select a different endpoint or pass extra body fields; it must not re-implement `call()`, `apiErr()`, or `openaiData()` handling.

## Provider-specific error messages belong in the shared helpers

Provider-specific failure taxonomy belongs in `apiErr()`, `nice()`, and `openaiData()` in `src/studio.js`. A `genOnce()` branch selects endpoints and request bodies; it does not own user-facing error wording. Check this rule when a change adds a provider-specific branch anywhere in the request path.
