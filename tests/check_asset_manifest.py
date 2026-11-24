#!/usr/bin/env python3
"""Guard: the hashed JS/CSS must match the committed asset manifest.

The manifest (``tests/fixtures/assets.sha256``) is written by ``scripts/sync-js.py``.
Comparing it with the hashes derived from the current sources catches the mistake
that only the full browser suite used to catch: editing ``src/*.js`` and shipping
without rebuilding the hashed assets.
"""
import pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'scripts'))
from js_assets import ROOT, fixture_refs, hashed_assets, manifest_path


def read_manifest(path):
    out = {}
    if not path.is_file():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split()
        if len(parts) == 2:
            out[parts[0]] = parts[1]
    return out


def main():
    path = manifest_path()
    want = read_manifest(path)
    if not want:
        print(f'FAIL {path.relative_to(ROOT)} missing; run npm run build:js')
        return 1
    refs = fixture_refs()
    if len(refs) != 12:
        print('FAIL tests/fixtures/data is incomplete; run python3 scripts/refresh-ci-fixtures.py')
        return 1
    assets = hashed_assets(refs=refs)
    stale = []
    for name, (rel, _) in assets.items():
        if want.get(name) != rel:
            stale.append(f'{name}: manifest {want.get(name)} != {rel}')
    for name in want:
        if name not in assets:
            stale.append(f'{name}: manifest entry has no matching source file')
    if stale:
        print('FAIL hashed assets are stale:')
        for s in stale:
            print('  ' + s)
        print('run npm run build:js and commit tests/fixtures/assets.sha256')
        return 1
    print(f'PASS hashed asset manifest in sync ({len(assets)} files)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
