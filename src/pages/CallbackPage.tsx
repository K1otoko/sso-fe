import { useRequest } from 'ahooks'
import { Button, Card, Result, Spin, Steps, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, exchangeCode } from '../api/auth'
import type { TokenResponse } from '../api/auth'
import { beginAuthorize, clearPendingAuth, readPendingAuth } from '../lib/oidc'
import { saveSession } from '../lib/tokens'

const { Title, Text } = Typography

interface CallbackFailure {
  title: string
  description: string
}

/** 回跳参数校验结果（纯函数，进入页面时计算一次） */
type CallbackCheck =
  | { ok: true; code: string; codeVerifier: string }
  | { ok: false; failure: CallbackFailure }

function checkCallback(searchParams: URLSearchParams): CallbackCheck {
  const error = searchParams.get('error')
  if (error) {
    return {
      ok: false,
      failure: {
        title: '登录未完成',
        description: searchParams.get('error_description') ?? error,
      },
    }
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const pending = readPendingAuth()

  if (!code || !state || !pending || pending.state !== state) {
    return {
      ok: false,
      failure: {
        title: '校验未通过',
        description: '回跳参数不完整，或 state 与本地记录不一致，请重新发起登录。',
      },
    }
  }

  return { ok: true, code, codeVerifier: pending.codeVerifier }
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return (
      error.body.message ??
      error.body.error_description ??
      `${error.body.error}（HTTP ${error.status}）`
    )
  }
  return '发生未知错误，请重新发起登录'
}

/** 授权回跳处理页：校验 state → 授权码换令牌 → 进入工作台 */
export default function CallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  // 进入页面时校验回跳参数（惰性初始化，无副作用）
  const [check] = useState<CallbackCheck>(() => checkCallback(searchParams))
  const [stage, setStage] = useState<'exchanging' | 'done'>('exchanging')
  const [failure, setFailure] = useState<CallbackFailure | null>(
    check.ok ? null : check.failure,
  )
  const startedRef = useRef(false)

  const exchange = useRequest(
    ({ code, codeVerifier }: { code: string; codeVerifier: string }) =>
      exchangeCode(code, codeVerifier),
    {
      manual: true,
      onSuccess: (tokens: TokenResponse) => {
        saveSession(tokens)
        setStage('done')
        navigate('/', { replace: true })
      },
      onError: (error: unknown) => {
        setFailure({ title: '令牌换取失败', description: describeError(error) })
      },
    },
  )
  const { run: runExchange } = exchange

  // 发起换取令牌。注意：StrictMode 会对挂载期的 effect 做一次「模拟卸载」，
  // ahooks useRequest 会把此时发起的请求标记为已取消并静默丢弃结果（onSuccess/onError 都不触发），
  // 因此延后到宏任务里发起一次；真实卸载会清理这个定时器，startedRef 兜底防止重复换取。
  useEffect(() => {
    if (!check.ok) {
      return
    }
    const timer = window.setTimeout(() => {
      if (startedRef.current) {
        return
      }
      startedRef.current = true
      clearPendingAuth()
      void runExchange({ code: check.code, codeVerifier: check.codeVerifier })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [check, runExchange])

  const stepsItems = [
    { title: '校验回跳参数与 state', content: '已通过' },
    {
      title: '使用授权码换取令牌',
      content: stage === 'done' ? '已完成' : '正在请求认证中心 /token',
    },
    {
      title: '载入身份信息',
      content: stage === 'done' ? '已完成' : '等待中',
    },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        padding: '56px 16px',
        background: '#f5f5f5',
      }}
    >
      <Card style={{ width: '100%', maxWidth: 480, height: 'fit-content' }}>
        {failure !== null ? (
          <Result
            status="error"
            title={failure.title}
            subTitle={failure.description}
            extra={[
              <Button key="retry" type="primary" onClick={() => void beginAuthorize()}>
                重新登录
              </Button>,
              <Button key="home" onClick={() => navigate('/')}>
                返回首页
              </Button>,
            ]}
          />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>
              正在完成安全登录…
            </Title>
            <Text type="secondary">请勿关闭或刷新当前页面</Text>
            <Steps
              orientation="vertical"
              size="small"
              current={stage === 'done' ? 2 : 1}
              status={stage === 'done' ? 'finish' : 'process'}
              items={stepsItems}
              style={{ marginTop: 24, textAlign: 'left' }}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
