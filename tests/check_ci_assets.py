#!/usr/bin/env python3
"""Guard: the CI fixture dist carries a _headers that passes the CSP check.

CI assembles dist from tests/fixtures instead of running build.py, so any
_header-generating step has to live in that assembly path too. Also pins the
shared CSP builder to the pre-refactor production value.
"""
import pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))


def old_csp(sh, hotlinks, depths, ah, wat):
    """The literal construction from post.py before csp.py was extracted."""
    img = " ".join(["'self'", 'data:', 'blob:', *depths, *hotlinks, *([ah] if ah else [])])
    return ("default-src 'self'; script-src 'self' " + sh + (" https://static.cloudflareinsights.com" if wat else "") + "; style-src 'self' 'unsafe-inline'; img-src " + img + "; font-src 'self' data:; "
            "connect-src 'self' data: blob: https://api.openai.com https://generativelanguage.googleapis.com https://*.volces.com https://*.bytepluses.com https://oaidalleapiprodscus.blob.core.windows.net https://*.googleusercontent.com http://127.0.0.1:* http://localhost:*" + (" " + " ".join(hotlinks) if hotlinks else "") + (" https://cloudflareinsights.com" if wat else "") + "; "
            "worker-src 'self'; manifest-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests")


def main():
    problems = []
    with tempfile.TemporaryDirectory() as td:
        subprocess.run([sys.executable, str(ROOT / 'scripts' / 'ci-assets.py'), td], check=True, capture_output=True)
        r = subprocess.run([sys.executable, str(ROOT / 'tests' / 'check_csp.py'), td], capture_output=True, text=True)
        if r.returncode:
            problems.append('CI-assembled dist fails check_csp.py:')
            problems.extend(r.stdout.strip().splitlines() + r.stderr.strip().splitlines())
    try:
        from csp import csp_value
    except ImportError as e:
        problems.append(f'cannot import shared CSP builder: {e}')
    else:
        cases = [
            ('', [], [], '', False),
            ("'sha256-abc'", ['https://a.example'], ['https://d.example'], '', False),
            ("'sha256-abc'", ['https://a.example'], [], 'https://cdn.example', True),
        ]
        for sh, hotlinks, depths, ah, wat in cases:
            got = csp_value(sh, hotlinks, depths, ah, wat)
            want = old_csp(sh, hotlinks, depths, ah, wat)
            if got != want:
                problems.append('csp_value diverged from post.py CSP:\n  got:  ' + got + '\n  want: ' + want)
    if problems:
        print('FAIL CI asset/CSP contract:')
        print('\n'.join('  ' + p for p in problems))
        return 1
    print('PASS CI-assembled dist has a valid _headers; shared CSP builder matches post.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
