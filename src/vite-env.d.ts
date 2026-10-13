/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 认证中心 issuer，默认 http://127.0.0.1:4000/oidc */
  readonly VITE_ISSUER?: string
  /** public client id，默认 web */
  readonly VITE_CLIENT_ID?: string
  /** 请求 scope，默认 openid profile email */
  readonly VITE_SCOPE?: string
  /** 授权回跳地址，默认 http://127.0.0.1:5173/callback */
  readonly VITE_REDIRECT_URI?: string
  /** 登出回跳地址，默认 http://127.0.0.1:5173/ */
  readonly VITE_POST_LOGOUT_REDIRECT_URI?: string
}
