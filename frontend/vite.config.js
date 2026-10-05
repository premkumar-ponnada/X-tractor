import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// The SPA calls /api on its own origin. In dev, Vite proxies it to FastAPI so the
// session cookie stays same-origin; in production a reverse proxy does the same.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined // Vite ids always use forward slashes
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react'
            if (/node_modules\/(recharts|d3-[^/]+|victory-vendor)\//.test(id)) return 'charts'
            if (/node_modules\/(react-markdown|remark-[^/]+|micromark[^/]*|mdast-[^/]+|unified|hast-[^/]+)\//.test(id)) return 'markdown'
            return undefined
          },
        },
      },
    },
  }
})
