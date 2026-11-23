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

`localStorage` values are JSON-encoded by `LS`/`SV` in `src/app.js` and `src/studio.js`; tests injecting values must `JSON.stringify` them. `npm test` runs the full browser suite and requires `npm run serve` on port 8787; `npm run test:static` needs no server.
