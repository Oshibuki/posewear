#!/usr/bin/env python3
"""Guard: .gitignore entries must not name files git already tracks.

An ignore entry for a tracked file is dead config: git keeps tracking the
file, and the entry misleads readers into thinking the file is local-only.
The 2026-11-24 capability-matrix round committed two such dead entries
(the guard scripts themselves); this check keeps them out permanently.
"""
import pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    out = subprocess.run(
        ['git', '-C', str(ROOT), 'ls-files', '-i', '-c', '--exclude-standard'],
        capture_output=True, text=True,
    )
    dead = [line for line in out.stdout.splitlines() if line.strip()]
    if out.returncode != 0:
        print(f'FAIL gitignore-tracked check could not run: {out.stderr.strip()}')
        return 1
    if dead:
        print('FAIL .gitignore entries for tracked files are dead config:')
        print('\n'.join('  ' + d for d in dead))
        print('  Remove the entry, or stop tracking the file (git rm --cached).')
        return 1
    print('PASS no .gitignore entry covers a tracked file')
    return 0


if __name__ == '__main__':
    sys.exit(main())
