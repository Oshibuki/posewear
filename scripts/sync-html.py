#!/usr/bin/env python3
"""Copy src/index.html to dist with hashed asset refs and record its source hash.

    python3 scripts/sync-html.py [target-dir] [--skip-manifest]

``--skip-manifest`` leaves ``tests/fixtures/index-html.sha256`` alone: CI builds the
dist from the committed fixtures and must not rewrite the manifest it is checked
against.
"""
import hashlib, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from js_assets import ROOT, hashed_refs


def source_name(name):
    return name if '.' in name else name + '.json'


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
    src = ROOT / 'src' / 'index.html'
    if not src.is_file():
        raise SystemExit('src/index.html missing')
    html = src.read_text()
    refs = hashed_refs(dist=dist)
    for name, ref in refs.items():
        before = '"' + source_name(name) + '"'
        html = html.replace(before, '"' + ref + '"')
    left = [source_name(name) for name in refs if '"' + source_name(name) + '"' in html]
    if left:
        raise SystemExit('unreplaced source refs: ' + ', '.join(left))
    dist.mkdir(parents=True, exist_ok=True)
    (dist / 'index.html').write_text(html)
    if not skip:
        manifest = ROOT / 'tests' / 'fixtures' / 'index-html.sha256'
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(hashlib.sha256(src.read_bytes()).hexdigest() + '\n')
        print(f'synced: {manifest.relative_to(ROOT)}')
    print(f'synced: {dist / "index.html"}')


if __name__ == '__main__':
    main()
