# sd.cpp 本地模型管理 API（契约）

PoseWear 访问 stable-diffusion.cpp（`sd-server`）的**原生模型管理端点**：读配方目录、看已加载模型、在用户显式确认后加载配方。生成请求走另一族（OpenAI 兼容），见 `docs/adr/0001-sdcpp-local-direct.md`。

**Base**：配置里的 Base URL 去掉结尾 `/v1`，默认 `http://127.0.0.1:1234`。端点前缀 `/sdcpp/v1/`。**直连，不经过本站代理，不带鉴权头**（`auth()` 对 sdcpp 返回 `{}`）。

**跨源**：浏览器从站点 Origin 直连回环地址属于跨源请求；CORS 由本地服务的响应头声明、由浏览器强制执行，本站没有 CORS 开关，也不能改用本站代理（代理拒绝内网地址）。sd-server 默认回显 `Origin`、允许所有方法与头、`OPTIONS` 应答 204，因此无需用户配置。若接入非 sd-server 的本地实现，至少返回 `Access-Control-Allow-Origin`（回显站点 Origin 或 `*`）、`Access-Control-Allow-Methods: GET, POST, OPTIONS`、`Access-Control-Allow-Headers: Content-Type` 并处理 `OPTIONS`；`POST` 的 `Content-Type: application/json` 会触发预检。PoseWear 不带凭据，回显 Origin 与 `*` 均可，但不能与 `Allow-Credentials: true` 并用。站点侧的可达性由构建期 CSP `connect-src http://127.0.0.1:* http://localhost:*` 放行（`post.py`），与 CORS 是两层机制。

| 端点 | 方法 | 用途 |
|---|---|---|
| `/sdcpp/v1/recipes` | GET | 配方目录 |
| `/sdcpp/v1/models/status` | GET | 当前已加载模型的状态 |
| `/sdcpp/v1/models/load` | POST | 加载指定配方 |
| `/sdcpp/v1/models/refresh` | POST | 重新扫描配方与模型文件目录 |

本仓库的调用方：`src/studio.js` 的 `sdNative()`（传输族）、`sdRead()`（读目录与状态）、`sdRefresh()`（重扫后重读）、`sdStatus()`（读一次模型状态）、`sdLoad()`（加载）、`sdSync()`（失败后重读状态并校正界面）。改动任一端点用法前先读 `CODING_STANDARDS.md` 的「sd.cpp 模型管理走单一传输族」一条。

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

请求体为空（`{}` 也可以）。响应只含 `errors`，不返回刷新后的目录；刷新不改变已加载的模型上下文，已加载配方的能力快照要重新加载后才更新。`errors` 是重扫时跳过的无效配方条目（例如 `{"file":"recipes/broken.yaml","message":"invalid slots"}`），PoseWear 会把条目与原因显示在设置面板里，不静默丢弃。

PoseWear 的「刷新」按钮 = **先 POST 重扫，成功后才并发 GET `/recipes` 与 GET `/models/status`**；顺序固定，界面上的配方列表与已加载模型都来自重扫后的读取。重扫失败时用 `'refresh'` 作用域报错（映射表 `REFRESH_ERR`），不重读目录也不误报为模型加载或生图失败；仅打开设置面板时仍只做一次普通读取，不触发重扫。

## 来源与核对

契约核对自 stable-diffusion.cpp 的 `examples/server/api.md`（上游仓库 `ggml-org/stable-diffusion.cpp`；核对时使用过同名 fork 的 `master` 镜像，上游 master 的 raw 链接当时返回 404）。**改动前先确认上游文件位置**，字段或端点若已变化，以本文件与上游一致为准并同步更新。
