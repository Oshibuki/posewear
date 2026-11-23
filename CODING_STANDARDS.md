# Coding Standards

Rules applied during code review.

## Provider branches reuse the shared builder for their transport family

When adding a provider branch to `genOnce()` in `src/studio.js`, use the shared builder for that transport family: `json()` for JSON generation requests, `sendReferenceRequest()` for multipart reference-image requests. A branch may select endpoint, body fields, image field, response policy, and fallback policy; it must not re-implement `call()`, `apiBody()`, `apiErr()`, or `openaiData()` handling. See `docs/adr/0002-shared-reference-image-request.md` for the policy-object decision.

## Provider-specific error messages belong in the shared helpers

Provider-specific failure taxonomy belongs in `apiErr()`, `nice()`, and `openaiData()` in `src/studio.js`. A `genOnce()` branch selects endpoints and request bodies; it does not own user-facing error wording. Check this rule when a change adds a provider-specific branch anywhere in the request path.
