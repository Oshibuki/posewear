#!/usr/bin/env python3
"""Guard: browser tests must run against hashed dist assets built from current src."""
import pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'scripts'))
from js_assets import ROOT, hashed_assets


def main():
    dist = ROOT / 'dist'
    index = dist / 'index.html'
    if not index.is_file():
        print('FAIL dist/index.html missing; run python3 build.py')
        return 1
    try:
        assets = hashed_assets()
    except SystemExit as e:
        print('FAIL ' + str(e))
        return 1
    html = index.read_text()
    stale = [rel for rel, _ in assets.values()
             if '/' + rel not in html or not (dist / rel).is_file()]
    if stale:
        print('FAIL dist is stale for: ' + ', '.join(stale))
        print('run npm run build:js after changing src/*.js or src/style.css')
        return 1
    print(f'PASS dist hashed assets in sync ({len(assets)} files)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
