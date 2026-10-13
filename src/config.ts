/** 认证中心联调默认值与 docs/frontend-integration.md 保持一致，可通过 .env 覆盖。 */
function readEnv(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
}

/** 认证中心 issuer（生产为其公网域名） */
export const ISSUER = readEnv(
  import.meta.env.VITE_ISSUER,
  'http://127.0.0.1:4000/oidc',
).replace(/\/+$/, '')

/** 认证中心源。交互 API 挂在根路径 /interaction（不在 issuer 的 /oidc 之下），与后端路由注册一致 */
export const AUTH_ORIGIN = new URL(ISSUER).origin

/** public client id（无 client_secret），授权类型 authorization_code + PKCE（S256） */
export const CLIENT_ID = readEnv(import.meta.env.VITE_CLIENT_ID, 'web')

/** 请求的 scope */
export const SCOPE = readEnv(import.meta.env.VITE_SCOPE, 'openid profile email')

/** 授权回跳地址（需在认证中心白名单登记） */
export const REDIRECT_URI = readEnv(
  import.meta.env.VITE_REDIRECT_URI,
  'http://127.0.0.1:5173/callback',
)

/** 登出回跳地址（需在认证中心白名单登记） */
export const POST_LOGOUT_REDIRECT_URI = readEnv(
  import.meta.env.VITE_POST_LOGOUT_REDIRECT_URI,
  'http://127.0.0.1:5173/',
)

/** access_token 到期前多少毫秒开始静默刷新 */
export const REFRESH_AHEAD_MS = 60_000
