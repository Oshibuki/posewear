#!/usr/bin/env python3
"""Refresh the CI fixture set: gallery data JSON + the images the browser suites touch.

The browser suites need a servable site. The real site is built from the raw asset
mirror (7.9 GB of images), which CI does not have. This script snapshots the two
things the suites actually load:

- ``tests/fixtures/data/<name>.json`` - the 12 gallery data files (3.1 MB), copied
  byte-for-byte from ``dist/assets`` so their content hashes stay identical.
- ``tests/fixtures/img/<path>`` - the images of the first items of the categories a
  suite picks from (costume + pose), so ``assetBlob()`` fetches succeed.

Run it after a data change (the data comes from the raw mirror, not from git):

    python3 scripts/refresh-ci-fixtures.py
"""
import json
import pathlib
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from js_assets import ROOT, DATA

FIX = ROOT / 'tests' / 'fixtures'
CATEGORIES = ['costumes', 'poses']
PER_GROUP = 3


def load_items(dist, name):
    hits = sorted((dist / 'assets').glob(name + '.[0-9a-f]*.json'))
    if not hits:
        raise SystemExit(f'missing hashed data asset {name}; run python3 build.py first')
    raw = json.loads(hits[0].read_text())
    return raw['items'] if isinstance(raw, dict) and 'items' in raw else raw


def wanted_items(items):
    """First PER_GROUP items plus the first PER_GROUP visible (non-18+) ones."""
    picked = {}
    for it in items[:PER_GROUP]:
        picked[it['id']] = it
    for it in [x for x in items if not x.get('a')][:PER_GROUP]:
        picked[it['id']] = it
    return list(picked.values())


def image_paths(it):
    if it.get('angles'):
        a = it['angles'][0]
        return [a.get('t'), a.get('i')]
    return [it.get('t'), it.get('i')]


def main():
    dist = ROOT / 'dist'
    data_out = FIX / 'data'
    img_out = FIX / 'img'
    for p in data_out.glob('*.json'):
        p.unlink()
    if img_out.exists():
        shutil.rmtree(img_out)
    data_out.mkdir(parents=True, exist_ok=True)

    for name in DATA:
        src = next((dist / 'assets').glob(name + '.[0-9a-f]*.json'))
        (data_out / f'{name}.json').write_bytes(src.read_bytes())

    copied = 0
    missing = []
    for name in CATEGORIES:
        for it in wanted_items(load_items(dist, name)):
            for rel in image_paths(it):
                if not rel or rel.startswith('http'):
                    continue
                src = dist / rel.lstrip('/')
                if not src.is_file():
                    missing.append(rel)
                    continue
                dst = img_out / rel.lstrip('/')
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, dst)
                copied += 1

    print(f'fixtures: {len(DATA)} data files -> {data_out.relative_to(ROOT)}')
    print(f'fixtures: {copied} images -> {(img_out.relative_to(ROOT))}')
    if missing:
        print('missing images (skipped): ' + ', '.join(sorted(set(missing))))
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
