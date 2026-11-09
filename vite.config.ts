import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Reads .env / .env.local too, not only the shell environment.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Never updates behind the user's back: the app asks, and reloads when told to
        // (components/layout/UpdatePrompt.tsx).
        registerType: 'prompt',
        injectRegister: false,
        // Off in the tests: the virtual modules still resolve, to no-ops.
        disable: mode === 'test',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'PersonalBudget',
          short_name: 'PersonalBudget',
          description: 'Seu orçamento pessoal: lançamentos, contas, cartões e caixa.',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#ffffff',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Only the app shell is cached, so it opens without a connection. There is no runtime
          // cache for /api: money data always comes from the server, and without a connection the
          // app says so (OfflineBanner) instead of showing a stale balance.
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // Listens on the LAN too, so the phone opens http://<PC IP>:5173.
      host: true,
      proxy: {
        // Same origin for the browser: the API's CORS config never comes into play.
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            // The browser sends Origin on POST/PATCH/DELETE even on the same origin; behind the
            // proxy the API would take it for a cross-origin call and its CORS filter answers 403.
            proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
          },
        },
      },
    },
  }
})
