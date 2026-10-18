import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: { headers: securityHeaders },
  server: {
    headers: securityHeaders,
    proxy: {
      '/api': globalThis.process?.env.OMS_BACKEND_URL || 'http://127.0.0.1:5000',
      '/static/uploads': globalThis.process?.env.OMS_BACKEND_URL || 'http://127.0.0.1:5000',
    },
  },
})
