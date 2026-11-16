import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The version lives in package.json only; both the app and the server read it
// from there, so nothing can drift.
const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8')) as {
  version: string
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    // Vite rejects unknown Host headers, which is what a tunnel presents.
    // Only the tunnel providers are allowed; everything else stays blocked.
    allowedHosts: ['.serveousercontent.com', '.lhr.life', '.trycloudflare.com', '.ngrok-free.app'],
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
