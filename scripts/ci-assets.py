#!/usr/bin/env python3
"""Assemble a servable dist from the committed CI fixtures - no asset mirror needed.

CI has no raw asset mirror (7.9 GB of images), only the fixture snapshot in
``tests/fixtures``. This script writes what the browser suites load:

- ``<dist>/assets/<name>.<sha256[:10]>.json`` - the gallery data, named exactly as
  ``build.py`` names it, so the hashed ``app.js`` is identical to a local build.
- ``<dist>/<path>`` - the fixture images, at the paths the data JSON points to.
- ``<dist>/_headers`` - a minimal CSP built by the same ``csp_value()`` as the
  production header, so ``tests/check_csp.py`` can validate the fixture dist.

    python3 scripts/ci-assets.py [target-dir]     # default: dist
"""
import hashlib
import json
import pathlib
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from js_assets import ROOT
from csp import csp_value

FIX = ROOT / 'tests' / 'fixtures'
IMG_KEYS = {'t', 'i', 'o', 'm'}


def collect_origins(obj, found):
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in IMG_KEYS and isinstance(value, str) and value.startswith('https://'):
                found.add('/'.join(value.split('/')[:3]))
            else:
                collect_origins(value, found)
    elif isinstance(obj, list):
        for value in obj:
            collect_origins(value, found)


def main():
    target = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'dist'
    data = FIX / 'data'
    if not data.is_dir() or not list(data.glob('*.json')):
        raise SystemExit('tests/fixtures/data is empty; run python3 scripts/refresh-ci-fixtures.py')
    (target / 'assets').mkdir(parents=True, exist_ok=True)
    origins = set()
    for src in sorted(data.glob('*.json')):
        payload = src.read_bytes()
        h = hashlib.sha256(payload).hexdigest()[:10]
        (target / 'assets' / f'{src.stem}.{h}.json').write_bytes(payload)
        try:
            collect_origins(json.loads(payload), origins)
        except Exception:
            pass
    n = 0
    img = FIX / 'img'
    if img.is_dir():
        for src in sorted(img.rglob('*')):
            if not src.is_file():
                continue
            dst = target / src.relative_to(img)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dst)
            n += 1
    (target / '_headers').write_text('/*\n  Content-Security-Policy: ' + csp_value(img_origins=sorted(origins)) + '\n')
    print(f'ci assets: {len(list(data.glob("*.json")))} data + {n} images + _headers -> {target}')


if __name__ == '__main__':
    main()
