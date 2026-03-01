import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Strip /api from path before forwarding to backend
        // Frontend calls /api/expenses -> backend receives /expenses
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
