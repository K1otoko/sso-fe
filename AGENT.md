# SSO Frontend AI 工作说明

本文供在本仓库工作的 AI 使用。修改前先阅读本文、`README.md`、
`docs/frontend-integration.md` 和相关实现。若说明与代码不一致，以当前代码和
实际 SSO 协议为准，并同步修正文档。

## 1. 项目定位

本项目是统一身份认证前端，基于 React 19、TypeScript、Vite 8、Ant Design 6
和 ahooks，负责：

- 展示登录页并向 SSO interaction API 提交用户名和密码。
- 发起 OIDC authorization code + PKCE 流程并校验 state。
- 在回跳页使用授权码换取 token。
- 保存、刷新和清除浏览器会话。
- 展示当前身份、token 有效期和登出入口。

本项目不签发或验证 JWT 签名，不管理用户，不代理业务 API，也不是管理控制台。
认证协议属于 `../sso`，业务请求鉴权属于 `../gateway`，平台控制台位于
`../console-fe`。

## 2. 当前页面和代码

页面：

- `/`：身份工作台；未登录时发起授权，登录后显示 ID token claims。
- `/login?interaction=<uid>`：SSO 跳转进入的凭据页面。
- `/callback`：校验 state、交换授权码并保存会话。
- 其他路径：404。

关键文件：

- `src/config.ts`：issuer、client、scope 和回跳地址。
- `src/api/auth.ts`：interaction、token、refresh 请求及统一错误类型。
- `src/lib/pkce.ts`：PKCE 和 state 随机值。
- `src/lib/oidc.ts`：授权跳转、待处理授权状态和登出 URL。
- `src/lib/tokens.ts`：会话存储、ID token 解码和单飞刷新。
- `src/pages/`：页面组件。
- `vite.config.ts`：固定开发地址及本地 API 代理。

接口类型和请求函数集中放在 `src/api/`，页面不重复定义后端响应类型。可复用的
协议逻辑放在 `src/lib/`，不要散落到组件中。

## 3. 重要的已知现状

SSO 后端当前真实 issuer 路径固定为 `/api/sso/oidc`，但本仓库
`src/config.ts`、`.env.example` 和部分对接文档的本地默认值仍写成旧的
`http://127.0.0.1:4000/oidc`。联调时应显式使用：

```dotenv
VITE_ISSUER=http://127.0.0.1:4000/api/sso/oidc
```

不要基于旧路径新增接口。修复默认值时应同时更新配置、README 和对接文档。

`src/api/auth.ts` 使用同源 `/api/sso/**` 请求；本地由 Vite 代理到 SSO 后端，
生产由前端 Nginx 代理。授权跳转地址则由 `VITE_ISSUER` 直接生成。

当前没有自动化测试、Dockerfile 或 CI 发布工作流。不要把 `pnpm build` 描述成
完整的登录回归测试。

## 4. 本地工作

```bash
pnpm install
pnpm dev
```

开发服务器固定为 `http://127.0.0.1:5173`，不能改用 `localhost` 或自动切换
端口，因为 SSO 的 CORS 和 redirect URI 白名单要求精确匹配。

常用验证：

```bash
pnpm build
pnpm exec oxlint <本次修改的文件...>
pnpm preview
```

只对本次修改或新增的代码文件执行 Oxlint，不运行全项目 lint 或 format。不要删除
现有 `console.log`。纯 Markdown 变更无需代码 lint。

没有测试脚本时，协议逻辑变更至少手工验证：发起登录、错误凭据、授权回跳、
刷新轮换、刷新失败清理会话和登出。UI 变更应检查桌面与移动视口，确认无溢出、
遮挡或不可操作控件。

## 5. 配置与浏览器安全

Vite 编译期变量：

- `VITE_ISSUER`
- `VITE_CLIENT_ID`
- `VITE_SCOPE`
- `VITE_REDIRECT_URI`
- `VITE_POST_LOGOUT_REDIRECT_URI`

所有 `VITE_*` 值都会进入浏览器产物，绝不能放密码、client secret、Cookie key、
数据库信息或私钥。当前 `web` 是 public client，不能引入前端 client secret。

存储约定：

- PKCE verifier 和 state 暂存在 `sessionStorage`。
- access、ID、refresh token 当前存于 `localStorage` 的 `sso.session`。
- refresh token 每次刷新都会轮换，成功后必须整体覆盖会话。
- `refreshSession` 的单飞逻辑不可移除，否则并发重放旧 refresh token 会导致授权
  被撤销。
- `decodeJwtPayload` 只做展示用解码，不是签名验证或权限判断。

避免把 token 打到日志、错误监控、URL、DOM 或截图中。新增 HTML 注入点、富文本
或第三方脚本时，必须评估 localStorage token 的 XSS 风险。

## 6. 跨项目协议

本前端依赖 `../sso` 的以下契约：

- issuer：`/api/sso/oidc`
- 登录：`POST /api/sso/interaction/:uid/login`
- token：`POST /api/sso/oidc/token`
- 登出：`GET {issuer}/session/end`
- client ID：`web`
- scope：`openid profile email`
- redirect：`/callback`
- ID token claims：`sub`、`role`、`name`、`preferred_username`、`email`

SSO 的 `userinfo` 未启用。不要新增对 userinfo 的依赖。access token 用于调用
Gateway，ID token 只用于前端身份展示，两者不能混用。

未来调用业务 API 时，应向 `/api/gateway/**` 携带
`Authorization: Bearer <access token>`，不要从浏览器直接调用 Deployment 容器，
也不要自行注入 `X-User-*` 身份头。

## 7. 生产拓扑

2026-10-15 已核验：

```text
浏览器
  -> https://sso.xpeach.top
  -> 前端服务器 101.200.164.181
  -> Nginx 静态目录 /project/sso-fe/dist
  -> /api/** 原样代理到 https://api.xpeach.top
  -> 后端 Nginx
  -> /api/sso/** 到 SSO
  -> /api/gateway/** 到 Gateway
```

生产构建的配置应匹配：

- issuer：`https://sso.xpeach.top/api/sso/oidc`
- redirect：`https://sso.xpeach.top/callback`
- post logout redirect：`https://sso.xpeach.top/`

这些值同时必须出现在 SSO 的 CORS 与 redirect URI 配置中。Vite 配置是编译期
配置，修改服务器环境文件不会改变已经生成的 `dist`，必须重新构建和发布。

当前仓库没有自动部署流程；不要假设推送代码会更新
`/project/sso-fe/dist`。完整服务器链路见 `../生产部署前检查清单.md`。

## 8. 修改规则

1. 开始前运行 `git status --short`，保留所有非本任务改动。
2. OIDC 参数、存储键、响应类型或刷新策略变更必须同步检查 SSO。
3. API 错误文案可以面向用户，但不能暴露服务堆栈、数据库或账号枚举信息。
4. 不用前端状态、ID token 解码结果或隐藏按钮代替后端权限校验。
5. 沿用 React Router、Ant Design 和 ahooks 的现有模式，避免引入重复框架。
6. 不提交真实账号、密码、token、Cookie 或 `.env.local`。
7. 不运行破坏性 Git 命令，不覆盖用户未提交的修改。

## 9. 完成标准

- 修改过的代码文件逐一通过 Oxlint。
- `pnpm build` 通过。
- 协议改动与 SSO 实际路径、client 和令牌响应一致。
- 登录相关改动完成端到端手工验证。
- UI 改动检查桌面和移动端、加载、空状态、错误状态及键盘操作。
- 生产构建不包含秘密，且配置值与 SSO 白名单精确匹配。
