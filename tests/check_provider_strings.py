#!/usr/bin/env python3
"""Guard: provider identity checks must go through the PROV capability table."""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PATTERN = re.compile(r"""(?:cfg\s*\.\s*prov|\bprov|\bP)\s*[!=]==?\s*['"]sdcpp['"]""")


def offenders(text, name):
    return [f'{name}:{i}: {line.strip()}' for i, line in enumerate(text.splitlines(), 1) if PATTERN.search(line)]


def main():
    found = []
    for path in sorted((ROOT / 'src').glob('*.js')):
        found.extend(offenders(path.read_text(), path.relative_to(ROOT).as_posix()))
    if found:
        print('FAIL provider string checks outside the capability table:')
        print('\n'.join(found))
        print('use isLocal/provInfo helpers from src/studio.js instead')
        return 1
    print('PASS no scattered sdcpp provider string checks')
    return 0


if __name__ == '__main__':
    sys.exit(main())
