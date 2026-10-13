import { AUTH_ORIGIN, CLIENT_ID, ISSUER, REDIRECT_URI } from '../config'

/* ============================== 接口类型定义 ============================== */

/** 登录请求体：POST {issuer}/interaction/{uid}/login */
export interface LoginPayload {
  username: string
  password: string
}

/** 登录成功响应 */
export interface LoginResult {
  /** 认证中心给出的继续流程地址，直接跳转即可 */
  redirectTo: string
}

/** 认证中心错误响应体（401 / 429 / token 端点错误等统一形状） */
export interface ApiErrorBody {
  error: string
  message?: string
  error_description?: string
  /** 429 限流时剩余等待秒数（取响应体 retry_after 或 Retry-After 头） */
  retry_after?: number
}

/** POST {issuer}/token 响应（access_token 10 分钟；refresh_token 14 天，刷新即轮换） */
export interface TokenResponse {
  access_token: string
  id_token: string
  refresh_token: string
  token_type: string
  /** access_token 有效期（秒） */
  expires_in: number
}

/** ID token 的 claims（userinfo 端点未启用，身份信息直接读 ID token） */
export interface IdTokenClaims {
  sub: string
  role?: 'super' | 'admin' | 'user'
  name?: string
  preferred_username?: string
  email?: string
  exp?: number
}

/** 统一的请求错误：HTTP 状态 + 认证中心错误体 */
export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? body.error_description ?? body.error)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/* ============================== 接口请求函数 ============================== */

/** 单次请求超时（毫秒）：认证中心或数据库异常时避免页面无限等待 */
const REQUEST_TIMEOUT_MS = 15_000

/** 底层 fetch 封装：自动解析 JSON、错误归一化为 ApiError */
async function request<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(0, {
        error: 'timeout',
        message: '认证中心响应超时，请稍后重试',
      })
    }
    throw new ApiError(0, {
      error: 'network_error',
      message: '无法连接认证中心，请确认服务已启动',
    })
  }

  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const body: ApiErrorBody =
      data !== null && typeof data === 'object' ? (data as ApiErrorBody) : { error: 'unknown_error' }
    if (body.retry_after === undefined) {
      const retryAfter = Number(response.headers.get('retry-after'))
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        body.retry_after = retryAfter
      }
    }
    throw new ApiError(response.status, body)
  }

  return data as T
}

/**
 * 提交登录凭据（认证中心登录页专用，浏览器需携带会话 cookie）。
 * 对应文档第 2 节第 3 步：POST {auth-origin}/interaction/{uid}/login
 * 注意：交互 API 挂载在认证中心根路径（不在 issuer 的 /oidc 之下），
 * 与后端 src/auth/interaction.ts 的路由注册保持一致。
 */
export function submitLogin(interaction: string, payload: LoginPayload): Promise<LoginResult> {
  return request<LoginResult>(`${AUTH_ORIGIN}/interaction/${encodeURIComponent(interaction)}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

/**
 * 授权码换令牌（authorization_code + PKCE）。
 * 对应文档第 2 节第 5 步：POST {issuer}/token
 */
export function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  return request<TokenResponse>(`${ISSUER}/token`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }).toString(),
  })
}

/**
 * 刷新令牌。注意轮换规则：刷新成功后旧 refresh_token 立即作废，
 * 必须用返回值覆盖本地存储，绝不要重放旧令牌（会触发泄露检测导致整条授权作废）。
 */
export function refreshToken(refreshTokenValue: string): Promise<TokenResponse> {
  return request<TokenResponse>(`${ISSUER}/token`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
      client_id: CLIENT_ID,
    }).toString(),
  })
}
