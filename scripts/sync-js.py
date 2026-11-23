#!/usr/bin/env python3
"""Refresh hashed JS/CSS assets in dist after a source-only change."""
import pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from js_assets import ROOT, h8, hashed_assets


def main():
    dist = ROOT / 'dist'
    index = dist / 'index.html'
    if not index.is_file():
        raise SystemExit('dist/index.html missing; run python3 build.py first')
    assets = hashed_assets()
    for rel, data in assets.values():
        (dist / rel).write_bytes(data)

    html = index.read_text()
    for name, (rel, _) in assets.items():
        base, ext = name.rsplit('.', 1)
        pattern = rf'/assets/{re.escape(base)}\.[0-9a-f]{{10}}\.{ext}'
        html, n = re.subn(pattern, '/' + rel, html)
        if not n:
            raise SystemExit(f'no reference to {name} in dist/index.html')
    index.write_text(html)

    sw = dist / 'sw.js'
    if sw.is_file():
        code = sw.read_text()
        for name, (rel, _) in assets.items():
            base, ext = name.rsplit('.', 1)
            code = re.sub(rf'/assets/{re.escape(base)}\.[0-9a-f]{{10}}\.{ext}', '/' + rel, code)
        code = re.sub(r"const V='posewear-v10-[0-9a-f]+'",
                      "const V='posewear-v10-" + h8(''.join(r for r, _ in assets.values())) + "'", code)
        sw.write_text(code)

    current = {pathlib.Path(rel).name for rel, _ in assets.values()}
    for p in (dist / 'assets').iterdir():
        if p.is_file() and p.suffix in ('.js', '.css') and p.name not in current:
            p.unlink()
    print('synced: ' + ', '.join(rel for rel, _ in assets.values()))


if __name__ == '__main__':
    main()
