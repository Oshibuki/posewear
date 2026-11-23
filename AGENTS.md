## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `Oshibuki/posewear` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five canonical role labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Generation code

Studio generation and provider branches live in `src/studio.js` (`genOnce`, `run`). Tray quick generation lives in `src/app.js` (`tgSync`, `#tgGo`). See `CODING_STANDARDS.md` when adding a provider branch.

### Browser state and tests

`localStorage` values are JSON-encoded by `LS`/`SV` in `src/app.js` and `src/studio.js`; tests injecting values must `JSON.stringify` them. `npm test` runs the full browser suite and requires `npm run serve` on port 8787; `npm run test:static` needs no server. Browser tests load hashed assets from `dist/`: after changing `src/*.js` or `src/style.css`, run `npm run build:js`; after changing `src/index.html`, run `npm run build:html` and commit `tests/fixtures/index-html.sha256`. The `npm test` preflight checks both hashed assets and `dist/index.html`; `npm run test:static` checks the committed index hash and the provider-string guard. Browser tests block Service Workers to avoid stale cached scripts.
