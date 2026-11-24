#!/usr/bin/env python3
"""Guard: the sd.cpp reference-image matrix and its ADR pointer stay present.

The matrix records what upstream docs actually demonstrate, so deleting it or
weakening its evidence markers would silently reintroduce the client/server
wording drift this guard was added to prevent.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MATRIX_HEADING = '## 参考图能力矩阵（生成端点）'
CONTRACT_FACTS = [
    '本矩阵描述 `/v1/images/edits` 生成请求的上游模型能力',
    '不属于原生模型管理端点',
    '非穷尽清单',
    '2026-11-24',
    '6b3edaaf',
    '有示例（img2img）',
    '有示例（参考图输入）',
    '未标注',
    'Stable Diffusion 1.x',
    'FLUX.2',
    'FLUX.1-Kontext-dev',
    'Qwen Image Edit',
    'Stable Diffusion 2.x',
    'SDXL',
    'sd-cli -r',
    'docs/sd.md',
    'docs/flux2.md',
    'docs/kontext.md',
    'docs/qwen_image_edit.md',
    'IP-Adapter（外观/风格）',
    'ControlNet（姿态/结构）',
    '明确支持',
    '仅代码可见',
    'vid_gen 明确不支持',
    '本项目以 IP-Adapter 控制人物外观',
    '以 ControlNet 控制人物姿态',
    'SD1.5 等级的模型',
    '表中 SD1.5 之外的模型族',
    'docs/ip_adapter.md',
    'src/model/diffusion/control.hpp',
    'examples/server/api.md',
]
ADR_FACTS = ['docs/sdcpp-api.md', '参考图能力矩阵（生成端点）']


def main():
    problems = []
    contract = (ROOT / 'docs' / 'sdcpp-api.md').read_text()
    adr = (ROOT / 'docs' / 'adr' / '0002-shared-reference-image-request.md').read_text()
    if MATRIX_HEADING not in contract:
        problems.append('docs/sdcpp-api.md: capability matrix heading is missing')
    for fact in CONTRACT_FACTS:
        if fact not in contract:
            problems.append(f'docs/sdcpp-api.md: matrix misses {fact!r}')
    for fact in ADR_FACTS:
        if fact not in adr:
            problems.append(f'docs/adr/0002-shared-reference-image-request.md: misses pointer {fact!r}')
    if problems:
        print('FAIL sd.cpp reference-image capability matrix contract:')
        print('\n'.join('  ' + p for p in problems))
        return 1
    print('PASS sd.cpp reference-image matrix and ADR pointer are present')
    return 0


if __name__ == '__main__':
    sys.exit(main())
