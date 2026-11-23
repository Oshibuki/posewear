#!/usr/bin/env python3
"""Guard: src/index.html changes must refresh its committed hash manifest."""
import hashlib, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    src = ROOT / 'src' / 'index.html'
    manifest = ROOT / 'tests' / 'fixtures' / 'index-html.sha256'
    if not src.is_file() or not manifest.is_file():
        print('FAIL missing src/index.html or tests/fixtures/index-html.sha256; run npm run build:html')
        return 1
    expected = manifest.read_text().strip()
    actual = hashlib.sha256(src.read_bytes()).hexdigest()
    if expected != actual:
        print('FAIL src/index.html changed without npm run build:html')
        return 1
    print('PASS index.html hash manifest in sync')
    return 0


if __name__ == '__main__':
    sys.exit(main())
