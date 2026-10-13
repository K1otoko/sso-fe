import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { useRequest } from 'ahooks'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError, submitLogin } from '../api/auth'
import type { LoginPayload } from '../api/auth'

const { Title, Text } = Typography

interface LoginNotice {
  type: 'error' | 'warning'
  text: string
}

/** 认证中心登录页（无登录会话时由认证中心 302 到 /login?interaction=xxx） */
export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const interaction = searchParams.get('interaction')
  const missingInteraction = !interaction

  const [notice, setNotice] = useState<LoginNotice | null>(null)
  const [retrySeconds, setRetrySeconds] = useState(0)
  const cooling = retrySeconds > 0

  const login = useRequest((payload: LoginPayload) => submitLogin(interaction ?? '', payload), {
    manual: true,
    onBefore: () => setNotice(null),
    onSuccess: (result) => {
      // 文档第 2 节第 4 步：浏览器直接续跑认证中心流程，最终落回 redirect_uri
      window.location.assign(result.redirectTo)
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        setNotice({ type: 'error', text: '用户名或密码错误，请检查后重试' })
      } else if (error instanceof ApiError && error.status === 429) {
        const seconds = error.body.retry_after ?? 60
        setRetrySeconds(seconds)
        setNotice({ type: 'warning', text: `尝试次数过多，请 ${seconds} 秒后重试` })
      } else if (error instanceof ApiError) {
        setNotice({ type: 'error', text: error.body.message ?? `登录失败（${error.body.error}）` })
      } else {
        setNotice({ type: 'error', text: '登录失败，请稍后重试' })
      }
    },
  })

  // 429 重试倒计时：归零后允许再次提交
  useEffect(() => {
    if (!cooling) {
      return
    }
    const timer = window.setInterval(() => {
      setRetrySeconds((seconds) => (seconds > 0 ? seconds - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooling])

  const noticeText =
    notice === null
      ? null
      : notice.type === 'warning'
        ? cooling
          ? `尝试次数过多，请 ${retrySeconds} 秒后重试`
          : '可以重新尝试登录'
        : notice.text

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        background: '#f5f5f5',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span
              style={{
                display: 'inline-flex',
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                background: '#1677ff',
                color: '#fff',
                fontSize: 24,
              }}
            >
              <SafetyCertificateOutlined />
            </span>
            <Title level={3} style={{ margin: '16px 0 4px' }}>
              统一身份认证中心
            </Title>
            <Text type="secondary">请使用组织账号登录，以继续访问应用</Text>
          </div>

          {missingInteraction ? (
            <Alert
              type="error"
              showIcon
              title="缺少 interaction 参数，请从应用入口发起登录"
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Form<LoginPayload>
            layout="vertical"
            onFinish={(values) => {
              void login.run(values)
            }}
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                size="large"
                prefix={<UserOutlined />}
                placeholder="请输入用户名"
                autoComplete="username"
              />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </Form.Item>
            {noticeText !== null ? (
              <Alert
                type={notice?.type}
                showIcon
                title={noticeText}
                style={{ marginBottom: 16 }}
              />
            ) : null}
            <Button
              type="primary"
              size="large"
              block
              htmlType="submit"
              loading={login.loading}
              disabled={cooling || missingInteraction}
            >
              登录
            </Button>
          </Form>
        </Card>
        <Text
          type="secondary"
          style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 12 }}
        >
          © 2026 Northstar · 受企业安全策略保护
        </Text>
      </div>
    </div>
  )
}
