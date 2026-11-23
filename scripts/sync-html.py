#!/usr/bin/env python3
"""Copy src/index.html to dist with hashed asset refs and record its source hash."""
import hashlib, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from js_assets import ROOT, hashed_refs


def source_name(name):
    return name if '.' in name else name + '.json'


def main():
    src = ROOT / 'src' / 'index.html'
    dist = ROOT / 'dist' / 'index.html'
    manifest = ROOT / 'tests' / 'fixtures' / 'index-html.sha256'
    if not src.is_file() or not dist.parent.is_dir():
        raise SystemExit('src/index.html or dist/ missing; run python3 build.py first')
    html = src.read_text()
    refs = hashed_refs()
    for name, ref in refs.items():
        before = '"' + source_name(name) + '"'
        html = html.replace(before, '"' + ref + '"')
    left = [source_name(name) for name in refs if '"' + source_name(name) + '"' in html]
    if left:
        raise SystemExit('unreplaced source refs: ' + ', '.join(left))
    dist.write_text(html)
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(hashlib.sha256(src.read_bytes()).hexdigest() + '\n')
    print('synced: dist/index.html + tests/fixtures/index-html.sha256')


if __name__ == '__main__':
    main()
