import { refreshToken as requestRefreshToken } from '../api/auth'
import type { IdTokenClaims, TokenResponse } from '../api/auth'

/** 本地保存的登录会话（localStorage） */
export interface StoredSession {
  accessToken: string
  idToken: string
  refreshToken: string
  /** access_token 过期时间（毫秒时间戳） */
  expiresAt: number
  /** access_token 总有效期（秒） */
  expiresIn: number
}

const SESSION_KEY = 'sso.session'

export function loadSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) {
    return null
  }
  try {
    const session = JSON.parse(raw) as StoredSession
    return session.accessToken && session.expiresAt ? session : null
  } catch {
    return null
  }
}

/** 用 token 端点返回值覆盖本地会话（刷新轮换：必须整体替换，不能只更新一部分） */
export function saveSession(tokens: TokenResponse): StoredSession {
  const session: StoredSession = {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    expiresIn: tokens.expires_in,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

/** 解析 JWT payload（仅 Base64URL 解码，不做签名校验；可信度由认证中心 HTTPS 颁发保证） */
export function decodeJwtPayload(token: string): IdTokenClaims | null {
  const payload = token.split('.')[1]
  if (!payload) {
    return null
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as IdTokenClaims
  } catch {
    return null
  }
}

let pendingRefresh: Promise<StoredSession> | null = null

/**
 * 刷新会话（单飞）。
 * 并发刷新会重放旧 refresh_token，触发泄露检测导致整条授权作废，
 * 因此任意时刻只允许一个刷新请求在途，其余调用复用同一个 Promise。
 */
export function refreshSession(): Promise<StoredSession> {
  if (pendingRefresh) {
    return pendingRefresh
  }

  const session = loadSession()
  if (!session) {
    return Promise.reject(new Error('当前没有可刷新的登录会话'))
  }

  pendingRefresh = requestRefreshToken(session.refreshToken)
    .then((tokens) => saveSession(tokens))
    .catch((error: unknown) => {
      clearSession()
      throw error
    })
    .finally(() => {
      pendingRefresh = null
    })

  return pendingRefresh
}
