"""Shared hashed-asset calculation for scripts/sync-js.py and tests/check_dist_sync.py."""
import hashlib, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ['style.css', 'app.js', 'zip.js', 'extras.js', 'studio.js', 'history.js']
DATA = ['poses', 'costumes', 'anime', 'portraits', 'depths', 'expressions', 'hair',
        'dynasties', 'scenes', 'lights', 'props', 'furniture']


def h8(b):
    return hashlib.sha256(b if isinstance(b, bytes) else b.encode()).hexdigest()[:10]


def hashed_assets(src=ROOT / 'src', dist=ROOT / 'dist'):
    """Return {source name: ('assets/<name>.<hash>.<ext>', bytes)} for current sources."""
    refs = {}
    for name in DATA:
        hits = sorted((dist / 'assets').glob(name + '.[0-9a-f]*.json'))
        if not hits:
            raise SystemExit(f'missing hashed data asset {name}; run python3 build.py first')
        refs[name] = '/assets/' + hits[0].name
    out = {}
    for name in FILES:
        data = (src / name).read_bytes()
        if name == 'app.js':
            text = data.decode()
            for key, ref in refs.items():
                text = text.replace("'" + key + ".json'", "'" + ref + "'")
            data = text.encode()
        base, ext = name.rsplit('.', 1)
        out[name] = (f'assets/{base}.{h8(data)}.{ext}', data)
    return out
