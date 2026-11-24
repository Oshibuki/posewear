# ADR-0001: Local sd.cpp generation uses direct browser connection, not the site proxy

- Status: accepted
- Date: 2026-11-23

## Context

PoseWear is a static site with a Cloudflare Pages Function at `/api/proxy` that forwards provider requests. The proxy deliberately refuses private-network targets (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.0.0/16`, etc.); a test asserts that `http://192.168.1.5:8188/...` is rejected.

stable-diffusion.cpp's server (`sd-server`) listens on `127.0.0.1:1234` by default. Its OpenAI-compatible API family (`/v1/images/generations`, `/v1/images/edits`, `/v1/models`) returns `data[].b64_json`, matching the shape PoseWear already parses. The server echoes the browser's `Origin` in `Access-Control-Allow-Origin`, sets `Allow-Credentials: true`, allows all methods and headers, and answers `OPTIONS` with 204. It has no authentication.

## Decision

The sd.cpp provider will be reached by a **direct browser connection** to a user-configured local base URL. The site proxy's private-network ban stays unchanged. No server-side route is added for sd.cpp.

Image generation uses the OpenAI-compatible family (`/v1/images/edits` and `/v1/images/generations`), reusing the existing `openaiData()` response parser. The selectable model list is the OpenAI-compatible model catalog (`/v1/models`), so OpenAI-compatible local servers such as Lemonade can expose their real models. Loading a sd.cpp recipe still uses the native `/sdcpp/v1/*` model-management endpoints, and a recipe is loaded only when the user explicitly confirms the selection, not when the dropdown value changes. The endpoint contract for that native family is recorded in `docs/sdcpp-api.md`.

## Consequences

- The existing proxy security boundary and its tests remain intact.
- CORS is declared by the local server and enforced by the browser; this site has no CORS toggle. The code-side reachability settings are the direct-connection provider policy and the build-time CSP `connect-src` allowlist. The proxy cannot substitute for CORS because it refuses private addresses.
- Loopback HTTP is generally treated as potentially trustworthy by Chrome and Firefox, so HTTPS pages can usually call `127.0.0.1` without a mixed-content block. Safari, older browsers, enterprise policies and newer local-network permission prompts can still block or gate it; the UI must surface a connection failure clearly, and opening the site over http:// or arranging local HTTPS remains a user-side fallback.
- Because sd.cpp has no authentication and reflects any Origin, the local server is exposed to any page the user visits while it runs; binding to loopback is therefore required, and widening the listen address is discouraged in documentation.
- Image generation reuses the OpenAI-compatible response shape, so the generation adapter needs one new branch. Model discovery is the OpenAI-compatible catalog; recipe loading remains the native-API surface. The two are kept distinct so the synchronous generation path stays simple. When the catalog cannot be read, the UI surfaces the failure and keeps the provider's documented default model ID as a fallback.
- Model loading is an explicit user action with a visible pending state. A failed load must not silently leave the previous model in effect under a new label.
