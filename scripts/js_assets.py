"""Shared hashed-asset calculation for scripts/sync-js.py and tests/check_dist_sync.py."""
import hashlib, pathlib


ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ['style.css', 'app.js', 'zip.js', 'extras.js', 'studio.js', 'history.js']
DATA = ['poses', 'costumes', 'anime', 'portraits', 'depths', 'expressions', 'hair',
        'dynasties', 'scenes', 'lights', 'props', 'furniture']


def h8(b):
    return hashlib.sha256(b if isinstance(b, bytes) else b.encode()).hexdigest()[:10]


def manifest_path():
    return ROOT / 'tests' / 'fixtures' / 'assets.sha256'


def data_refs(dist=ROOT / 'dist'):
    """Return {data name: '/assets/<hashed>.json'} from the local build output."""
    refs = {}
    for name in DATA:
        hits = sorted((dist / 'assets').glob(name + '.[0-9a-f]*.json'))
        if not hits:
            raise SystemExit(f'missing hashed data asset {name}; run python3 build.py first')
        refs[name] = '/assets/' + hits[0].name
    return refs


def fixture_refs(fix=ROOT / 'tests' / 'fixtures'):
    """Return {data name: '/assets/<hashed>.json'} from the committed CI fixture.

    Same naming as ``build.py`` (sha256 of the content), so the hashed ``app.js``
    is identical whether it was built locally or in CI.
    """
    refs = {}
    for p in sorted((fix / 'data').glob('*.json')):
        refs[p.stem] = '/assets/%s.%s.json' % (p.stem, h8(p.read_bytes()))
    return refs


def hashed_assets(src=ROOT / 'src', dist=ROOT / 'dist', refs=None):
    """Return {source filename: ('assets/<name>.<hash>.<ext>', bytes)} for current sources."""
    refs = data_refs(dist) if refs is None else refs
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


def hashed_refs(src=ROOT / 'src', dist=ROOT / 'dist', refs=None):
    """Return every source asset name -> hashed dist URL."""
    refs = data_refs(dist) if refs is None else refs
    for name, (rel, _) in hashed_assets(src, dist, refs).items():
        refs[name] = '/' + rel
    return refs
