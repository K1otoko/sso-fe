import {
  DownOutlined,
  LogoutOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useInterval, useRequest } from 'ahooks'
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Layout,
  Progress,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import { REFRESH_AHEAD_MS } from '../config'
import { beginAuthorize, buildLogoutUrl } from '../lib/oidc'
import { clearSession, decodeJwtPayload, loadSession, refreshSession } from '../lib/tokens'
import type { StoredSession } from '../lib/tokens'

const { Header, Content, Footer } = Layout
const { Title, Text } = Typography

/** 身份工作台：未登录时发起统一登录；已登录时展示身份与令牌状态，支持刷新与登出 */
export default function HomePage() {
  const { message } = App.useApp()
  const [session, setSession] = useState<StoredSession | null>(() => loadSession())
  const [now, setNow] = useState(() => Date.now())

  useInterval(() => setNow(Date.now()), 1000)

  const refresh = useRequest(refreshSession, {
    manual: true,
    onSuccess: (next) => {
      setSession(next)
      void message.success('令牌已刷新')
    },
    onError: () => {
      clearSession()
      setSession(null)
      void message.error('登录会话已失效，请重新登录')
    },
  })

  // 到期前自动静默刷新（refreshSession 内部单飞，避免并发刷新重放旧 refresh_token）
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  })
  useEffect(() => {
    if (!session) {
      return
    }
    const delay = Math.max(session.expiresAt - Date.now() - REFRESH_AHEAD_MS, 0)
    const timer = window.setTimeout(() => {
      void refreshRef.current.run()
    }, delay)
    return () => window.clearTimeout(timer)
  }, [session])

  const claims = session ? decodeJwtPayload(session.idToken) : null
  const displayName = claims?.name ?? claims?.preferred_username ?? '已登录用户'
  const remainingSeconds = session ? Math.max(0, Math.floor((session.expiresAt - now) / 1000)) : 0
  const percent = session
    ? Math.max(
        0,
        Math.min(100, Math.round(((session.expiresAt - now) / (session.expiresIn * 1000)) * 100)),
      )
    : 0
  const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(
    remainingSeconds % 60,
  ).padStart(2, '0')}`

  const handleLogout = () => {
    clearSession()
    // 跳转认证中心登出（内置确认页），确认后回跳 post_logout_redirect_uri
    window.location.assign(buildLogoutUrl())
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          paddingInline: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space size={10}>
          <Avatar
            shape="square"
            size={28}
            style={{ backgroundColor: '#1677ff' }}
            icon={<SafetyCertificateOutlined />}
          />
          <Text strong style={{ fontSize: 16 }}>
            统一身份认证中心
          </Text>
        </Space>
        {session ? (
          <Space size={8}>
            <Avatar size={28} style={{ backgroundColor: '#1677ff' }}>
              {displayName.slice(0, 1)}
            </Avatar>
            <Text>{displayName}</Text>
            <DownOutlined style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }} />
          </Space>
        ) : null}
      </Header>

      <Content style={{ width: '100%', maxWidth: 1080, margin: '0 auto', padding: '24px 24px 40px' }}>
        {session ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <Title level={4} style={{ marginBottom: 4 }}>
                身份工作台
              </Title>
              <Text type="secondary">当前登录信息与令牌状态（client_id：web）</Text>
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={14}>
                <Card
                  title="当前身份"
                  extra={<Tag color="blue">角色 {claims?.role ?? 'user'}</Tag>}
                  style={{ height: '100%' }}
                >
                  <Space size={16} style={{ marginBottom: 16 }}>
                    <Avatar size={52} style={{ backgroundColor: '#1677ff', fontSize: 20 }}>
                      {displayName.slice(0, 1)}
                    </Avatar>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{displayName}</div>
                      <Text type="secondary">{claims?.email ?? '—'}</Text>
                    </div>
                  </Space>
                  <Descriptions
                    column={1}
                    items={[
                      {
                        key: 'username',
                        label: '用户名',
                        children: claims?.preferred_username ?? '—',
                      },
                      {
                        key: 'sub',
                        label: '用户 ID（sub）',
                        children: (
                          <Text code style={{ wordBreak: 'break-all' }}>
                            {claims?.sub ?? '—'}
                          </Text>
                        ),
                      },
                      {
                        key: 'auth',
                        label: '登录方式',
                        children: '授权码 + PKCE（S256）',
                      },
                      {
                        key: 'session',
                        label: '登录会话',
                        children: '7 天滚动续期 · 覆盖全部接入应用',
                      },
                    ]}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
                  <Card title="访问令牌 access_token" extra={<Tag color="green">有效</Tag>}>
                    <Space align="baseline" size={8}>
                      <span
                        style={{
                          fontSize: 30,
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {countdown}
                      </span>
                      <Text type="secondary">后过期 · 有效期 10 分钟</Text>
                    </Space>
                    <Progress percent={percent} showInfo={false} style={{ marginTop: 8 }} />
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      调用业务 API 时通过 Authorization: Bearer 携带；到期前会自动静默刷新。
                    </Text>
                    <div style={{ marginTop: 16 }}>
                      <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        loading={refresh.loading}
                        onClick={() => void refresh.run()}
                      >
                        立即刷新
                      </Button>
                    </div>
                  </Card>
                  <Card title="刷新令牌 refresh_token">
                    <Space size={8} style={{ marginBottom: 12 }}>
                      <Tag color="green">有效</Tag>
                      <Text type="secondary">14 天（与登录会话绑定）</Text>
                    </Space>
                    <Alert
                      type="warning"
                      showIcon
                      title="每次刷新都会轮换令牌，重放旧令牌会导致整条授权作废。"
                      style={{ marginBottom: 16 }}
                    />
                    <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
                      退出登录
                    </Button>
                  </Card>
                </Space>
              </Col>
              <Col span={24}>
                <Card title="身份令牌 id_token（claims）">
                  <Text type="secondary">userinfo 端点未启用，身份信息直接读取 ID token：</Text>
                  <pre
                    style={{
                      margin: '12px 0 0',
                      padding: '14px 16px',
                      borderRadius: 8,
                      background: 'rgba(150,150,150,0.1)',
                      fontSize: 12.5,
                      lineHeight: 1.7,
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(claims, null, 2)}
                  </pre>
                </Card>
              </Col>
            </Row>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <Card style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
              <Avatar
                size={64}
                icon={<SafetyCertificateOutlined />}
                style={{ backgroundColor: '#e6f4ff', color: '#1677ff', marginBottom: 20 }}
              />
              <Title level={4} style={{ marginTop: 0 }}>
                尚未登录
              </Title>
              <Text type="secondary">
                点击下方按钮将跳转统一身份认证中心完成授权，成功后自动回到本页。
              </Text>
              <div style={{ marginTop: 24 }}>
                <Button type="primary" size="large" onClick={() => void beginAuthorize()}>
                  统一登录
                </Button>
              </div>
              <Text
                type="secondary"
                style={{ display: 'block', marginTop: 16, fontSize: 12 }}
              >
                将使用授权码 + PKCE（S256）流程 · client_id：web
              </Text>
            </Card>
          </div>
        )}
      </Content>

      <Footer style={{ textAlign: 'center', color: 'rgba(0,0,0,0.45)' }}>
        © 2026 Northstar · 受企业安全策略保护
      </Footer>
    </Layout>
  )
}
