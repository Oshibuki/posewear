#!/usr/bin/env python3
"""Guard: every README documents the local sd.cpp provider consistently.

The provider table is the public setup contract for visitors, and the settings
panel help is the in-app copy for the same provider. This check catches a
missing row, missing setup facts, broken table shape, or drift from the help.
"""
import pathlib, re, sys
from collections import namedtuple

ROOT = pathlib.Path(__file__).resolve().parent.parent
DocSpec = namedtuple('DocSpec', 'section header peers row https cors capability')
COMMON_PEERS = ['OpenAI', 'Gemini', 'Doubao Seedream', 'Custom relay']

DOCS = {
    'README.md': DocSpec(
        section=('### 支持的服务商', '## 更新日志'),
        header=['服务商', '需要准备', '默认模型', '说明'],
        peers=['OpenAI', 'Gemini', '豆包 Seedream', '自定义中转'],
        row=['sd.cpp', 'sd-server', '127.0.0.1:1234', '不需要 API Key', '只绑定本机', '不经过本站代理'],
        https=['HTTPS', 'http://', 'localhost:8787', '配置 HTTPS'],
        cors=['CORS', 'Access-Control-Allow-Origin', 'OPTIONS', 'connect-src', '预检', '无需额外配置'],
        capability=['参考图会被严格发送', 'IP-Adapter', 'ControlNet', 'SD1.5', '外观', '姿态', '报错或忽略图像', 'docs/sdcpp-api.md'],
    ),
    'README.en.md': DocSpec(
        section=('### Providers', '## Changelog'),
        header=['Provider', 'You need', 'Default model', 'Notes'],
        peers=COMMON_PEERS,
        row=['sd.cpp', 'sd-server', '127.0.0.1:1234', 'No API key', 'loopback', 'no site proxy'],
        https=['HTTPS', 'http://', 'localhost:8787', 'configure HTTPS for the local server'],
        cors=['CORS', 'Access-Control-Allow-Origin', 'OPTIONS', 'connect-src', 'preflight', 'no extra setup'],
        capability=['Reference images are always sent strictly', 'IP-Adapter', 'ControlNet', 'SD1.5', 'appearance', 'pose', 'report an error or ignore the image', 'docs/sdcpp-api.md'],
    ),
    'README.ja.md': DocSpec(
        section=('### プロバイダー', '## 変更履歴'),
        header=['プロバイダー', '必要なもの', '既定のモデル', '備考'],
        peers=COMMON_PEERS,
        row=['sd.cpp', 'sd-server', '127.0.0.1:1234', 'API キー不要', 'ループバック', 'プロキシは経由しません'],
        https=['HTTPS', 'http://', 'localhost:8787', 'HTTPS を設定'],
        cors=['CORS', 'Access-Control-Allow-Origin', 'OPTIONS', 'connect-src', 'プリフライト', '追加設定は不要'],
        capability=['参考画像は常に厳密に送信されます', 'IP-Adapter', 'ControlNet', 'SD1.5', '外観', 'ポーズ', 'エラーになる、または画像が無視される', 'docs/sdcpp-api.md'],
    ),
}

HELP_FACTS = ['127.0.0.1:1234', '不需要 API Key', '不经过本站代理', '只绑定本机地址', 'HTTPS', '混合内容']


def cells(line):
    return [c.strip() for c in line.strip().strip('|').split('|')]


def missing_facts(facts, text):
    return [fact for fact in facts if fact not in text]


def expect_four_columns(name, row, what, problems):
    if len(cells(row)) != 4:
        problems.append(f'{name}: {what} is not a four-column table row')


def check_doc(name, spec, problems):
    text = (ROOT / name).read_text()
    for left, right in (('[', ']'), ('(', ')')):
        if text.count(left) != text.count(right):
            problems.append(f'{name}: unbalanced {left}{right} in Markdown links')
    start, end = spec.section
    if start not in text or end not in text or text.index(end) < text.index(start):
        problems.append(f'{name}: provider section not found')
        return
    section = text[text.index(start):text.index(end)]
    rows = [line for line in section.splitlines() if line.strip().startswith('|')]
    if len(rows) < 6:
        problems.append(f'{name}: provider table has too few rows')
        return
    expect_four_columns(name, rows[0], 'provider table header', problems)
    if cells(rows[0]) != spec.header:
        problems.append(f'{name}: provider table header changed')
    if not re.fullmatch(r'\|[\s:|-]+\|', rows[1]):
        problems.append(f'{name}: provider table separator changed')
    expect_four_columns(name, rows[1], 'provider table separator', problems)
    first_cells = [cells(row)[0] for row in rows[2:]]
    for peer in spec.peers:
        if first_cells.count(peer) != 1:
            problems.append(f'{name}: existing provider row {peer} is missing or duplicated')
    local_rows = [row for row in rows if 'sd.cpp' in row]
    if len(local_rows) != 1:
        problems.append(f'{name}: expected exactly one sd.cpp provider row, found {len(local_rows)}')
        return
    expect_four_columns(name, local_rows[0], 'sd.cpp row', problems)
    row_text = ' '.join(cells(local_rows[0]))
    missing = missing_facts(spec.row, row_text)
    if missing:
        problems.append(f'{name}: sd.cpp row misses {missing}')
    missing = missing_facts(spec.https, section)
    if missing:
        problems.append(f'{name}: HTTPS/local-HTTP note misses {missing}')
    missing = missing_facts(spec.cors, section)
    if missing:
        problems.append(f'{name}: local CORS note misses {missing}')
    missing = missing_facts(spec.capability, section)
    if missing:
        problems.append(f'{name}: reference-image capability note misses {missing}')


def main():
    problems = []
    for name, spec in DOCS.items():
        check_doc(name, spec, problems)
    help_lines = [line for line in (ROOT / 'src' / 'studio.js').read_text().splitlines() if "[SDCPP]:'" in line]
    if len(help_lines) != 1:
        problems.append('src/studio.js: sd.cpp help text not found')
    else:
        missing = missing_facts(HELP_FACTS, help_lines[0])
        if missing:
            problems.append(f'src/studio.js: sd.cpp help text misses {missing}')
    if problems:
        print('FAIL sd.cpp documentation contract:')
        print('\n'.join('  ' + p for p in problems))
        return 1
    print('PASS sd.cpp docs, CORS notes and settings help are consistent')
    return 0


if __name__ == '__main__':
    sys.exit(main())
