# ADR-0002: Share one reference-image request pipeline with explicit provider policies

- Status: accepted
- Date: 2026-11-24

Reference-image generation requests across providers share the same multipart pipeline: build a body, call the provider, classify errors, and parse the returned image. We will expose that pipeline as one helper driven by an explicit policy object; each provider branch, including sdcpp, only declares endpoint, field, size, response constraints, fallback mode, and error scope. This removes the duplicated sdcpp request construction without changing other providers' behaviour.

## Considered Options

- **Thin provider branch + shared helper (chosen)**: the branch states policy; one helper owns FormData assembly, `call()`, `apiBody()`, `apiErr()` and `openaiData()`. This satisfies `CODING_STANDARDS.md` and keeps provider differences visible at the call site.
- **Push sdcpp conditions into the generic edits helper**: rejected because it spreads `if (sdcpp)` through the shared layer and makes future provider differences harder to see than an explicit policy object.
- **Keep a separate sdcpp pipeline**: rejected as the current technical debt; it duplicates the shared pipeline and lets sdcpp drift silently on headers, response shapes and error wording.
- **Automatic field/JSON fallback for sdcpp**: rejected because silently dropping the standard multi-image field or reference images contradicts the spec and hides local server misconfiguration.
- **Accept `url` responses and use `/api/proxy` fallback**: rejected because it breaks the local-direct, no-proxy invariant established in ADR-0001.

## Consequences

- `genOnce()` branches are policy declarations; they no longer assemble FormData or own user-facing error wording.
- sdcpp sends one strict multipart request: fixed `image[]`, fixed local model ID, explicit `size`, headers from `auth()` (empty for sdcpp), no status preflight, no fallback, and `b64_json` only.
- Existing providers keep their tolerant field/endpoint fallbacks and warnings; the shared helper returns `{ blob, warn? }` so callers do not invent result shapes.
- Tests stay at the browser HTTP boundary; no internal helper tests are introduced.
- Recipe loading (issue #6) and failed-load reconciliation (issue #7) remain separate; generation still uses the fixed OpenAI-family model ID.
