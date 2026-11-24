# 设计：sd.cpp 参考图能力矩阵与口径分层

- 日期：2026-11-24
- 状态：validated（已通过三轮设计校验；实施前按上游固定 commit 的 docs 证据修正矩阵条目，尚未实施，未提交）
- 触发问题：现有文档写「sd.cpp 严格发送参考图、不静默丢弃」，但上游 sd.cpp 并非对所有模型都支持通用 img2img；不支持时可能报错，也可能忽略输入图像。两种说法分属不同层，需要在文档里说清楚。

## 目标与非目标

目标是把「客户端策略」与「服务端能力」拆开表达，让用户和维护者都能看到：PoseWear 确实严格发送参考图，但请求发出不等于参考图在服务端生效。

非目标：不改 `src/` 运行时行为，不改 `fallback:'strict'`，不加模型类型前置判断，不改浏览器测试；不把矩阵写进 `GLOSSARY.md`（术语表保持无实现细节）。

## 已确认的设计决策

1. 只改文档与文档门禁，代码和生成行为保持现状。
2. 矩阵放在 `docs/sdcpp-api.md`，位于「来源与核对」之前，作为独立小节「参考图能力矩阵（生成端点）」。开头声明它描述 `/v1/images/edits` 的上游模型能力，不属于原生模型管理端点。
3. 矩阵锚定上游固定 commit `leejet/stable-diffusion.cpp@6b3edaaf32cc19e5bb2d819c788bd557eddc8eba` 的 `docs/`，核对日期 2026-11-24，并明确写「非穷尽清单；新增模型查对应上游 docs」。证据已逐页核对 `docs/sd.md`、`docs/flux2.md`、`docs/kontext.md`、`docs/qwen_image_edit.md` 与 `examples/server/api.md`。
4. 判断标准是「模型是否提供基于参考图生成结果图的能力」，而不是文档是否出现 `img2img` 一词。能力列只用三值：`有示例（img2img）`、`有示例（参考图输入）`、`未标注`。`-r` 参考图输入是能力证据，不能因为文档没写 `img2img` 就否认该能力，也不要把它改写成 `init_image`。
5. `docs/adr/0002-shared-reference-image-request.md` 的 Consequences 只增加一条指向矩阵的指针；原文「拒绝静默丢弃字段/参考图」是客户端设计决策，保留不改。
6. 三语 README 各加一句用户可见风险提示并链接矩阵；不复制表格。
7. 扩展 `tests/check_readme_contract.py`，并新增 `tests/check_sdcpp_capability_matrix.py` 接入 `npm run test:static`，防止文档漂移。

## 位置与分层声明

`docs/sdcpp-api.md` 矩阵小节前写：

> PoseWear 客户端严格发送参考图且不做字段/端点回退（见 ADR-0002）。下表描述上游服务端是否采用这些图像；两者不是同一层。请求已发出 ≠ 参考图已生效。

ADR-0002 Consequences 追加一条：

> This client-side strictness does not guarantee that the local server uses the images; model-dependent server behaviour is recorded in `docs/sdcpp-api.md` ("参考图能力矩阵（生成端点）").

## 矩阵草案

| 模型族 / 代表模型 | 参考图生图能力（按上游示例） | 图像输入方式 | 备注 / 风险 | 依据 |
|---|---|---|---|---|
| Stable Diffusion 1.x（示例为 SD 1.4） | 有示例（img2img） | `sd-cli -i ... --strength` | 文档明确给出从参考图生成结果的命令 | `docs/sd.md`，固定 commit `6b3edaa`
| FLUX.2-dev / klein 4B / klein 9B | 有示例（参考图输入） | `sd-cli -r` | 文档示例从参考图生成编辑结果；未使用 `img2img` 一词，不据此否认能力 | `docs/flux2.md`，固定 commit `6b3edaa`
| FLUX.1-Kontext-dev、Qwen Image Edit | 有示例（参考图输入） | `sd-cli -r` + 编辑提示词 | 文档示例为参考图 + 编辑指令生成结果，属于基于参考图的能力 | `docs/kontext.md`、`docs/qwen_image_edit.md`，固定 commit `6b3edaa`
| Stable Diffusion 2.x / SDXL、视频模型、仅文生架构 | 未标注 | 未在对应 docs 中给出参考图生图示例 | 不能据此断定不支持；若上游报错或忽略图像，PoseWear 不会静默改走纯文字 | 对应上游 docs 未给出示例，固定 commit `6b3edaa`

「来源与核对」段补一条：矩阵条目变化时必须同步更新依据列、上游版本/commit 与核对日期；上游字段或能力变化时以本文件与上游一致为准。上游 API 文档把 `image[]` 列为首选上传字段、`ref_images` 列为 `img_gen` 能力，但没有说明哪些模型采用这些图像；不要据此推断模型支持度。

2026-11-24 后续扩展：矩阵按用户更正加入 IP-Adapter 与 ControlNet 两个能力维度，判定标准改为「上游是否给出可核验的声明、示例或代码分支」；最新表格以 `docs/sdcpp-api.md` 为准。

## README 提示草案

- 中文：参考图会被严格发送；所选模型只有提供基于参考图的生图能力时才会据此生成结果，部分模型可能报错或忽略图像，详见 [sd.cpp API 契约的模型能力矩阵](docs/sdcpp-api.md)。
- English: Reference images are always sent strictly; a model that supports reference-image-based generation will use them, while some models report an error or ignore the image. See the [model capability matrix in the sd.cpp API contract](docs/sdcpp-api.md).
- 日本語：参考画像は常に厳密に送信されます。参考画像に基づく生成に対応したモデルのみがそれを使用し、一部のモデルではエラーになる、または画像が無視されることがあります。詳細は [sd.cpp API 契約のモデル能力マトリクス](docs/sdcpp-api.md) を参照してください。

链接相对路径以各 README 所在仓库根目录为准；实施时按现有 README 链接风格校准。

## 门禁与验证

- `tests/check_readme_contract.py`：给 `DocSpec` 增加 `capability` 字段，三语各自列出风险提示必备词与 `docs/sdcpp-api.md` 链接；在现有 provider 段落检查中一并提出缺失项。
- `tests/check_sdcpp_capability_matrix.py`（新增）：检查 `docs/sdcpp-api.md` 含矩阵标题、非穷尽声明、核对日期、三种能力取值（`有示例（img2img）` / `有示例（参考图输入）` / `未标注`）及四个模型族行；检查 ADR-0002 含指向矩阵的指针。接在 `package.json` 的 `test:static` 中 `check_readme_contract.py` 之后。
- 验证命令：`npm run test:static`。不跑 `npm run build:js` / `build:html`（未改 `src/*.js`、`src/style.css`、`src/index.html`），不跑浏览器套件。
- 实施顺序建议：红灯先写门禁 → 补文档 → 绿灯；随后在 PR #15 的描述里追加一句说明本轮只改文档口径、不改运行时行为。

## 开放风险

- 用户最初提供的模型分类来自经验性说明，实施前已按上游固定 commit 的 `docs/` 逐页修正；判断依据是「是否能从参考图生成结果图」，不是字面上的 `img2img`。无法核对的条目保持「未标注」，不得把 `-r` 参考图输入改写成 `init_image`。
- 上游模型能力变化快，矩阵的维护成本是选择 C 的已知代价；门禁只能检查结构存在，不能证明内容仍然正确。
