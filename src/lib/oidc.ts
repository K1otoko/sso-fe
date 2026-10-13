import { CLIENT_ID, ISSUER, POST_LOGOUT_REDIRECT_URI, REDIRECT_URI, SCOPE } from '../config'
import { createCodeChallenge, createCodeVerifier, createRandomState } from './pkce'

/** 一次待完成的授权请求（sessionStorage 暂存，回跳后取出校验） */
interface PendingAuthRequest {
  state: string
  codeVerifier: string
}

const PENDING_AUTH_KEY = 'sso.pendingAuth'

/** 读取待完成的授权请求（纯读取，不产生副作用） */
export function readPendingAuth(): PendingAuthRequest | null {
  const raw = sessionStorage.getItem(PENDING_AUTH_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as PendingAuthRequest
  } catch {
    return null
  }
}

/** 清除待完成的授权请求（回跳校验通过后调用，避免重放） */
export function clearPendingAuth(): void {
  sessionStorage.removeItem(PENDING_AUTH_KEY)
}

/** 生成 PKCE 参数并跳转认证中心 /auth，发起登录（文档第 2 节第 1 步） */
export async function beginAuthorize(): Promise<void> {
  const codeVerifier = createCodeVerifier()
  const codeChallenge = await createCodeChallenge(codeVerifier)
  const state = createRandomState()

  sessionStorage.setItem(PENDING_AUTH_KEY, JSON.stringify({ state, codeVerifier }))

  const url = new URL(`${ISSUER}/auth`)
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  window.location.assign(url.toString())
}

/** 认证中心登出地址（内置确认页，确认后回跳 post_logout_redirect_uri，文档第 5 节） */
export function buildLogoutUrl(): string {
  const url = new URL(`${ISSUER}/session/end`)
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('post_logout_redirect_uri', POST_LOGOUT_REDIRECT_URI)
  return url.toString()
}
