# sso-fe

统一身份认证中心前端：基于 React 19、TypeScript、Vite、Ant Design 6 与 ahooks。

## 环境要求

- Node.js >= 20.19
- pnpm >= 10

## 本地开发

```bash
pnpm install
pnpm dev
```

开发服务器固定运行在 `http://127.0.0.1:5173`（需与认证中心 CORS / 回跳白名单一致，请勿使用 localhost 访问）。

## 页面

| 路由 | 说明 |
| --- | --- |
| `/` | 身份工作台：未登录时发起统一登录；已登录时展示身份与令牌状态，支持刷新、登出 |
| `/login?interaction=xxx` | 认证中心登录页（认证中心无会话时 302 至此），提交账号密码 |
| `/callback` | 授权回跳处理页：校验 state、用授权码 + PKCE 换令牌 |
| `*` | 404 |

## 联调步骤

1. 启动认证中心（默认 `http://127.0.0.1:4000/oidc`，见 docs/frontend-integration.md）
2. 运行 `pnpm dev`，浏览器访问 `http://127.0.0.1:5173`
3. 环境变量默认已内置联调值；如需覆盖，复制 `.env.example` 为 `.env.local` 后修改

## 代码结构约定

- 所有认证中心接口请求函数与接口类型集中定义在 `src/api/auth.ts`，页面与组件不另行定义接口类型
- `src/lib/`：PKCE、OIDC 跳转、令牌存储与刷新等纯逻辑
- `src/pages/`：页面组件；接口调用统一通过 ahooks `useRequest`

## 常用命令

```bash
pnpm dev
pnpm build
pnpm lint
pnpm preview
```
