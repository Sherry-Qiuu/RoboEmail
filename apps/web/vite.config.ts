import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
