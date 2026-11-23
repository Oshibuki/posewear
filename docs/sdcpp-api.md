# sd.cpp 本地模型管理 API（契约）

PoseWear 访问 stable-diffusion.cpp（`sd-server`）的**原生模型管理端点**：读配方目录、看已加载模型、在用户显式确认后加载配方。生成请求走另一族（OpenAI 兼容），见 `docs/adr/0001-sdcpp-local-direct.md`。

**Base**：配置里的 Base URL 去掉结尾 `/v1`，默认 `http://127.0.0.1:1234`。端点前缀 `/sdcpp/v1/`。**直连，不经过本站代理，不带鉴权头**（`auth()` 对 sdcpp 返回 `{}`）。

| 端点 | 方法 | 用途 |
|---|---|---|
| `/sdcpp/v1/recipes` | GET | 配方目录 |
| `/sdcpp/v1/models/status` | GET | 当前已加载模型的状态 |
| `/sdcpp/v1/models/load` | POST | 加载指定配方 |
| `/sdcpp/v1/models/refresh` | POST | 重新扫描配方与模型文件目录 |

本仓库的调用方：`src/studio.js` 的 `sdNative()`（传输族）、`sdRead()`（读目录与状态）、`sdStatus()`（读一次模型状态）、`sdLoad()`（加载）、`sdSync()`（失败后重读状态并校正界面）。改动任一端点用法前先读 `CODING_STANDARDS.md` 的「sd.cpp 模型管理走单一传输族」一条。

## GET /sdcpp/v1/recipes

响应：`{"recipes":[{"id":"flux1-dev","name":"FLUX.1 dev","slots":[...],"defaults":{...}}],"errors":[{"file":"...","message":"..."}]}`

- 无效配方被跳过并记进 `errors`，不会让整个查询失败。
- UI 只需要 `id` 与 `name`；`slots` / `defaults` 等字段不暴露给用户。

## GET /sdcpp/v1/models/status

响应：`{"state":"empty|loading|ready|error","recipe":"<id>|null","models":{"<slot>":"<file>"},"error":null|"...","revision":12}`

- **命令行预加载**额外带 `origin:"command_line"`、`recipe:null`、`runtime_recipe:{"id":"@command-line"}`。`@command-line` 是只读表示，**不能**作为 load 的 `recipe` 提交。
- 加载中与加载失败后仍是这个结构：`state` 变成 `loading` / `error`。

## POST /sdcpp/v1/models/load

请求体：

```json
{ "recipe": "flux1-dev" }
```

- `models` 可省略 → 使用配方自带的默认模型选择。PoseWear 目前的做法就是省略：**不暴露单个模型文件**，用户只选配方。
- 成功响应即 `/models/status` 的结构（`state:"ready"`、`recipe` 为刚加载的配方）；无需重载时额外带 `already_loaded:true`。
- 失败响应体：`{"error":"<人类可读原因>","code":"<错误码>"}`。

| HTTP | code | 含义 |
|---|---|---|
| 400 | `invalid_model_config` | 配方或模型选择无效；校验在卸载旧模型之前完成，旧模型不会被卸掉 |
| 409 | `model_busy` | 还有生成请求或排队作业，加载被拒 |
| 422 | `model_load_failed` | 校验通过但模型初始化失败，最终不保留活动上下文 |
| 503 | `model_not_loaded` / `model_loading` | 没有已加载模型 / 正在加载或卸载 |

UI 侧：这些状态码与错误码由 `src/studio.js` 的 `apiErr()` 在 **load 作用域**映射成用户文案（映射表 `LOAD_ERR`），分支不自己写文案。

加载失败后 UI 会再读一次 `GET /sdcpp/v1/models/status`，把配方下拉框校正为服务器实际在用的配方（命令行预加载时是 `@command-line` 的只读表示）；失败原因与错误码留在设置面板里，校正不会覆盖它。生图请求返回 503（`model_not_loaded` / `model_loading`）时同样会重新读一次状态，避免界面停在已经失效的配方上。

## POST /sdcpp/v1/models/refresh

请求体为空（`{}` 也可以）。响应只含 `errors`，不返回刷新后的目录；刷新不改变已加载的模型上下文，已加载配方的能力快照要重新加载后才更新。

## 来源与核对

契约核对自 stable-diffusion.cpp 的 `examples/server/api.md`（上游仓库 `ggml-org/stable-diffusion.cpp`；核对时使用过同名 fork 的 `master` 镜像，上游 master 的 raw 链接当时返回 404）。**改动前先确认上游文件位置**，字段或端点若已变化，以本文件与上游一致为准并同步更新。
