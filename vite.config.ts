import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 回跳地址白名单固定为 127.0.0.1:5173，端口被占用时直接报错而不是自动换端口
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/sso': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
})
