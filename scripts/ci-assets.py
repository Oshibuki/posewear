#!/usr/bin/env python3
"""Assemble a servable dist from the committed CI fixtures - no asset mirror needed.

CI has no raw asset mirror (7.9 GB of images), only the fixture snapshot in
``tests/fixtures``. This script writes what the browser suites load:

- ``<dist>/assets/<name>.<sha256[:10]>.json`` - the gallery data, named exactly as
  ``build.py`` names it, so the hashed ``app.js`` is identical to a local build.
- ``<dist>/<path>`` - the fixture images, at the paths the data JSON points to.

    python3 scripts/ci-assets.py [target-dir]     # default: dist
"""
import hashlib
import pathlib
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from js_assets import ROOT

FIX = ROOT / 'tests' / 'fixtures'


def main():
    target = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'dist'
    data = FIX / 'data'
    if not data.is_dir() or not list(data.glob('*.json')):
        raise SystemExit('tests/fixtures/data is empty; run python3 scripts/refresh-ci-fixtures.py')
    (target / 'assets').mkdir(parents=True, exist_ok=True)
    for src in sorted(data.glob('*.json')):
        payload = src.read_bytes()
        h = hashlib.sha256(payload).hexdigest()[:10]
        (target / 'assets' / f'{src.stem}.{h}.json').write_bytes(payload)
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
    print(f'ci assets: {len(list(data.glob("*.json")))} data + {n} images -> {target}')


if __name__ == '__main__':
    main()
