## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `Oshibuki/posewear` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five canonical role labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Generation code

Studio generation and provider branches live in `src/studio.js` (`genOnce`, `run`). Tray quick generation lives in `src/app.js` (`tgSync`, `#tgGo`). See `CODING_STANDARDS.md` when adding a provider branch.

Local sd.cpp model management (recipe catalog, loaded model, explicit recipe load, rescan on refresh, status reconciliation after a failure) lives in `src/studio.js` (`sdNative`, `sdRead`, `sdRefresh`, `sdStatus`, `sdLoad`, `sdSync`, `sdRender`); the endpoint contract is `docs/sdcpp-api.md`.

`src/studio.js` and `src/app.js` use a dense one-line style: copy `old_str` verbatim from a fresh `read_file` and anchor it on a short unique substring. A paraphrased anchor (a retyped or dropped character) silently fails to match, and a multi-line block reformatted into many lines is not an anchor.

### Browser state and tests

`localStorage` values are JSON-encoded by `LS`/`SV` in `src/app.js` and `src/studio.js`; tests injecting values must `JSON.stringify` them. `npm test` runs the full browser suite and requires `npm run serve` on port 8787; `npm run test:static` needs no server. Browser tests load hashed assets from `dist/`: after changing `src/*.js` or `src/style.css`, run `npm run build:js` (it also rewrites `tests/fixtures/assets.sha256`); after changing `src/index.html`, run `npm run build:html` and commit `tests/fixtures/index-html.sha256`. `npm run test:static` checks the committed index hash, the committed asset manifest (a stale hashed build fails here) , the provider-string guard and the sd.cpp README contract guard. Browser tests block Service Workers to avoid stale cached scripts.

Wait on real state in browser tests (an option list, a rendered count), never on text a placeholder can satisfy. `npm run test:repeat` runs the browser suite three times to expose timing flakiness; run it before committing changes that touch rendering or async flows.

CI runs two jobs: `static` (`npm run test:static`) and `browser`, which assembles a servable dist from the committed fixture snapshot (`npm run ci:assets`, then `scripts/sync-html.py`/`sync-js.py` with `--skip-manifest` so the checked manifests stay untouched) and runs `npm run test:ci` (v13, v14, v17, v18, v19 + CSP). CI has no asset mirror, so v12 and v15 stay local: they assert that gallery images really load. The gallery data comes from the raw mirror, not from git — after a data change run `npm run fixtures:refresh` and commit `tests/fixtures/data/` and `tests/fixtures/img/`.
