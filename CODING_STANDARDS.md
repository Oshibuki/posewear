# Coding Standards

Rules applied during code review.

## Provider branches reuse the shared builder for their transport family

When adding a provider branch to `genOnce()` in `src/studio.js`, use the shared builder for that transport family: `json()` for JSON generation requests, `sendReferenceRequest()` for multipart reference-image requests. A branch may select endpoint, body fields, image field, response policy, and fallback policy; it must not re-implement `call()`, `apiBody()`, `apiErr()`, or `openaiData()` handling. See `docs/adr/0002-shared-reference-image-request.md` for the policy-object decision.

## Provider-specific error messages belong in the shared helpers

Provider-specific failure taxonomy belongs in `apiErr()`, `nice()`, and `openaiData()` in `src/studio.js`. A `genOnce()` branch selects endpoints and request bodies; it does not own user-facing error wording. Check this rule when a change adds a provider-specific branch anywhere in the request path.

## sd.cpp model management goes through one transport family

Calls to the sd.cpp native `/sdcpp/v1/*` endpoints (recipes, models/status, models/load, models/refresh) go through `sdNative()` in `src/studio.js`: one helper owns the URL prefix, the auth-free headers and the response/error handling, and a caller only picks the path and the body. The endpoint contract is `docs/sdcpp-api.md`; read it before adding or changing a call. A branch must not re-implement `fetch`, `apiBody()` or `apiErr()` for this family.

## Error scopes in `apiErr()` are a fixed vocabulary

`apiErr(r, j, scope)` takes one scope, and each scope has its own wording: no scope = generation failure, `'model'` = reading model information, `'load'` = loading a model (mapped by the `LOAD_ERR` table). Pick the scope that matches what the request was doing; do not reuse a generation phrase for a model-management failure, and do not add wording outside the shared helpers.

## Never claim a model is active before the server says so

The interface may only show a loaded model after a real status has been read (`sdCatalog.status`). A pending selection, a placeholder line, or a failed load must not render as "currently loaded". This is the interface half of the rule in `docs/adr/0001-sdcpp-local-direct.md`.

## The recipe selector shows the model the server reports as loaded

The recipe dropdown in the API settings (`#cfRecipe`) shows the recipe the server reports as loaded; a recipe the user has picked but not loaded is never presented as the model in effect. Such a pick is shown next to it as a pending label (`#cfRecipePending`, with a cancel action) and becomes the loaded model only after an explicit confirm. After a failed load, or after a generation failure that reports a model-state problem, the UI re-reads `GET /sdcpp/v1/models/status` and corrects the selection from that answer (`sdSync()` in `src/studio.js`); the failure reason stays on screen while the selection is corrected.
