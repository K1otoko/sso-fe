import {
  ArrowRightOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Button, Checkbox, Form, Input, message } from 'antd'
import type { FormProps } from 'antd'
import './App.css'

type LoginValues = {
  email: string
  password: string
  remember: boolean
}

const visualImage =
  'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=Editorial%20architectural%20photograph%20of%20a%20modern%20secure%20office%20atrium%2C%20frosted%20glass%2C%20lush%20indoor%20greenery%2C%20warm%20morning%20sunlight%2C%20subtle%20coral%20accent%2C%20clean%20geometric%20lines%2C%20premium%20corporate%20identity%2C%20realistic%2C%20high%20detail%2C%20no%20people%2C%20no%20text&image_size=portrait_4_3'

function App() {
  const [messageApi, contextHolder] = message.useMessage()

  const handleLogin: FormProps<LoginValues>['onFinish'] = ({ email }) => {
    void messageApi.success(`欢迎回来，${email}`)
  }

  return (
    <div className="app-shell">
      {contextHolder}

      <header className="site-header">
        <a className="brand" href="/" aria-label="Northstar Identity 首页">
          <span className="brand-mark" aria-hidden="true">
            <SafetyCertificateOutlined />
          </span>
          <span>Northstar Identity</span>
        </a>
        <a className="support-link" href="mailto:support@example.com">
          联系支持
        </a>
      </header>

      <main className="auth-layout">
        <section className="visual-panel" aria-labelledby="welcome-title">
          <img
            className="visual-image"
            src={visualImage}
            alt="阳光下的现代办公中庭"
          />
          <div className="visual-overlay" />
          <div className="visual-content">
            <span className="eyebrow">企业统一身份</span>
            <h1 id="welcome-title">一次登录，抵达所有工作空间。</h1>
            <p>安全、清晰地开启今天的工作。</p>
          </div>
          <div className="visual-index" aria-hidden="true">
            <span>01</span>
            <span className="visual-index-line" />
            <span>IDENTITY</span>
          </div>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-card">
            <div className="login-heading">
              <span className="eyebrow">WELCOME BACK</span>
              <h2 id="login-title">登录工作台</h2>
              <p>请输入你的组织账号</p>
            </div>

            <Form<LoginValues>
              layout="vertical"
              requiredMark={false}
              initialValues={{ remember: true }}
              onFinish={handleLogin}
            >
              <Form.Item
                label="邮箱"
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱地址' },
                  { type: 'email', message: '请输入有效的邮箱地址' },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="name@company.com"
                  autoComplete="email"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  size="large"
                />
              </Form.Item>

              <div className="form-options">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>保持登录</Checkbox>
                </Form.Item>
                <a href="/forgot-password">忘记密码？</a>
              </div>

              <Form.Item className="submit-item">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  icon={<ArrowRightOutlined />}
                  iconPlacement="end"
                >
                  登录
                </Button>
              </Form.Item>
            </Form>

            <div className="sso-divider">
              <span>或</span>
            </div>

            <Button className="sso-button" size="large" block>
              使用企业 SSO 登录
            </Button>

            <p className="legal-copy">
              登录即表示你同意<a href="/terms">服务条款</a>与
              <a href="/privacy">隐私政策</a>
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>© 2026 Northstar</span>
        <span>受企业安全策略保护</span>
      </footer>
    </div>
  )
}

export default App
