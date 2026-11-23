#!/usr/bin/env python3
"""把本机 nightmare 参考图镜像适配为 PoseWear 可构建的素材目录（不下载任何资源）。

镜像布局：~/.local/share/nightmare/refs/{pose,costume,portrait}/index.json + 图片。
本脚本在其中写入 PoseWear 需要的 data.json / images.js / ranking.js，
并生成使用本地深度图的 depth 包。运行前请确认 REFS_DIR 指向该镜像。
"""
import json
import os
import re
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
REFS = Path(os.environ.get('REFS_DIR', Path.home() / '.local/share/nightmare/refs')).resolve()
DEPTH_SRC = REPO / 'depth/packs/gia-depth'
DEPTH_DST = REFS / 'posewear-depth/gia-depth'

CAT_ZH_JA = {
    '春装': '春', '夏装': '夏', '秋装': '秋', '冬装': '冬',
    '内衣': 'ランジェリー', '派对': 'パーティ', '泳装': '水着', '性感': 'セクシー',
}
SEC_ZH = {'正面脸图': 'face', '造型参考': 'styling'}
HAIR_ZH_JA = {'短发': 'ショート', '中发': 'ミディアム', '中长发': 'セミロング', '长发': 'ロング'}
KW_RE = re.compile(r'((?:[a-zA-Z][a-zA-Z-]*\s+)+[a-zA-Z][a-zA-Z-]*)\s*$')


def dump(obj, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def items(name):
    return load(REFS / name / 'index.json')['items']


def require(rel):
    p = REFS / rel
    if not p.is_file() or p.stat().st_size == 0:
        sys.exit(f'本地资源缺失或为空：{p}')
    return p


def pose_data():
    """线稿姿势库：日文元数据取自仓库深度包（与镜像 ID 一一对应），图片取自镜像。"""
    rows = load(DEPTH_SRC / 'items.json')['items']
    out = []
    for row in rows:
        iid = row['id']
        thumb, full = f'thumbs/{iid}.jpg', f'img/{iid}.png'
        require('pose/' + thumb)
        require('pose/' + full)
        out.append({
            'id': iid, 'ポーズ名': row['ポーズ名'], 'ポーズ番号': row['ポーズ番号'],
            '系統': row['系統'], '分類': row['分類'], 'アングル': row['アングル'],
            'サムネ': thumb, '原寸': full,
        })
    dump({'D': out}, REFS / 'pose/data.json')
    return len(out)


def costume_data():
    out = []
    for it in items('costume'):
        iid, cat = it['id'], it['category']
        if cat not in CAT_ZH_JA:
            sys.exit(f'未知服装分类：{cat}')
        match = KW_RE.search(it['search'])
        if not match:
            sys.exit(f'无法提取服装关键词：{iid}')
        for rel in (f'thumbs/{iid}.webp', f'img/{iid}.webp', f'png/{iid}.png'):
            require('costume/' + rel)
        out.append({
            'id': iid, 'カテゴリ': CAT_ZH_JA[cat], 'キーワード': match.group(1),
            'サムネ': f'thumbs/{iid}.webp', '画像': f'img/{iid}.webp', '原寸': f'png/{iid}.png',
        })
    dump({'D': out}, REFS / 'costume/data.json')
    return len(out)


def anime_data():
    """镜像没有动画服装库；写入空数据让构建通过，不伪造资源。"""
    for sub in ('thumbs', 'img'):
        (REFS / 'anime' / sub).mkdir(parents=True, exist_ok=True)
    p = REFS / 'anime/data.json'
    if not p.exists():
        dump({'D': []}, p)
    return load(p)['D']


def portrait_data():
    out = []
    for it in items('portrait'):
        iid = it['id']
        if it['system'] not in SEC_ZH or it['category'] not in HAIR_ZH_JA:
            sys.exit(f'未知人像属性：{iid} {it["system"]} {it["category"]}')
        full = require(f'portrait/{it["image"]}')
        require(f'portrait/{it["thumb"]}')
        with Image.open(full) as image:
            w, h = image.size
        out.append({
            'id': iid, 'section': SEC_ZH[it['system']], 'hair': HAIR_ZH_JA[it['category']],
            'style': '', 'thumb': it['thumb'], 'full': it['image'], 'w': w, 'h': h,
        })
    (REFS / 'portrait/images.js').write_text(
        'const IMAGES=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8')
    dump({'top': {'総合': []}}, REFS / 'portrait/ranking.js')
    return len(out)


def local_depth_pack():
    """生成 source=local 的深度包，图片软链到本地镜像，避免构建时访问原站。"""
    manifest = load(DEPTH_SRC / 'manifest.json')
    doc = load(DEPTH_SRC / 'items.json')
    manifest['source'] = 'local'
    rows = []
    for row in doc['items']:
        iid = row['id']
        require(f'pose/thumbs/depth/{iid}.jpg')
        require(f'pose/img/depth/{iid}.png')
        r = dict(row)
        r['サムネ'] = f'thumbs/{iid}.jpg'
        r['原寸'] = f'img/{iid}.png'
        rows.append(r)
    dump(manifest, DEPTH_DST / 'manifest.json')
    dump({'meta': doc.get('meta', {}), 'items': rows}, DEPTH_DST / 'items.json')
    for name, target in [('thumbs', '../../pose/thumbs/depth'), ('img', '../../pose/img/depth')]:
        link = DEPTH_DST / name
        if link.is_symlink():
            if os.readlink(link) == target:
                continue
            link.unlink()
        elif link.exists():
            sys.exit(f'无法创建链接，目标已存在：{link}')
        link.symlink_to(target)
    return len(rows)


def main():
    if not (REFS / 'pose/gallery.json').is_file():
        sys.exit(f'找不到参考图镜像：{REFS}')
    counts = {
        '姿势线稿': pose_data(),
        '服装': costume_data(),
        '动画服装': len(anime_data()),
        '人像': portrait_data(),
        '深度图': local_depth_pack(),
    }
    print('本地资源适配完成：' + '，'.join(f'{k} {v}' for k, v in counts.items()))
    print('POSEWEAR_RAW=' + str(REFS))
    print('POSEWEAR_DEPTH=' + str(DEPTH_DST.parent))


if __name__ == '__main__':
    main()
