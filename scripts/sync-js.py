#!/usr/bin/env python3
"""Refresh hashed JS/CSS assets in dist after a source-only change.

    python3 scripts/sync-js.py [target-dir] [--skip-manifest]

``--skip-manifest`` leaves ``tests/fixtures/assets.sha256`` alone: CI builds the
dist from the committed fixtures and must not rewrite the manifest it is checked
against.
"""
import pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from js_assets import ROOT, h8, hashed_assets, manifest_path


def parse_args(argv):
    target, skip = None, False
    for a in argv:
        if a == '--skip-manifest':
            skip = True
        elif not a.startswith('--'):
            target = pathlib.Path(a).resolve()
    return target or ROOT / 'dist', skip


def main():
    dist, skip = parse_args(sys.argv[1:])
    index = dist / 'index.html'
    if not index.is_file():
        raise SystemExit(f'{index} missing; run python3 scripts/sync-html.py first')
    assets = hashed_assets(dist=dist)
    for rel, data in assets.values():
        (dist / rel).parent.mkdir(parents=True, exist_ok=True)
        (dist / rel).write_bytes(data)

    html = index.read_text()
    for name, (rel, _) in assets.items():
        base, ext = name.rsplit('.', 1)
        pattern = rf'/assets/{re.escape(base)}\.[0-9a-f]{{10}}\.{ext}'
        html, n = re.subn(pattern, '/' + rel, html)
        if not n:
            raise SystemExit(f'no reference to {name} in {index}')
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
    if not skip:
        path = manifest_path()
        path.write_text('# hashed asset manifest - written by scripts/sync-js.py\n' +
                        ''.join(f'{name} {rel}\n' for name, (rel, _) in sorted(assets.items())))
        print(f'synced: {path.relative_to(ROOT)}')
    print('synced: ' + ', '.join(rel for rel, _ in assets.values()))


if __name__ == '__main__':
    main()
