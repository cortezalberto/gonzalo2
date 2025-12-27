import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png'
      ],
      manifest: {
        name: 'El Buen Sabor - Menú Digital',
        short_name: 'El Buen Sabor',
        description: 'Menú digital compartido para restaurantes. Pedí desde tu mesa con tus amigos.',
        theme_color: '#f97316',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        id: '/',
        dir: 'ltr',
        lang: 'es',
        categories: ['food', 'lifestyle', 'shopping'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: 'screenshots/home.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Pantalla principal del menú'
          },
          {
            src: 'screenshots/cart.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Carrito compartido'
          }
        ],
        shortcuts: [
          {
            name: 'Ver Menú',
            short_name: 'Menú',
            description: 'Ir directamente al menú',
            url: '/',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          }
        ],
        related_applications: [],
        prefer_related_applications: false
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,jpg,jpeg}'],
        cleanupOutdatedCaches: true,
        // CACHE STRATEGY DOCUMENTATION:
        // skipWaiting: true  - Immediately activate new SW (don't wait for tabs to close)
        // clientsClaim: true - Take control of all pages immediately
        // TRADE-OFF: Aggressive updates mean users get new code fast, but may see brief
        // inconsistencies if cache format changes. Acceptable for restaurant menu app
        // where fresh data is important.
        skipWaiting: true,
        clientsClaim: true,
        // Fallback for offline navigation - SPA pattern
        // REASON: Return index.html for all navigation requests so React Router handles routing
        navigateFallback: '/index.html',
        // EXCLUDE: API calls should fail (not return HTML), public assets should 404 if missing
        navigateFallbackDenylist: [/^\/api/, /^\/public/],
        runtimeCaching: [
          // =================================================================
          // PRODUCT IMAGES - CacheFirst (30 days)
          // REASON: Images rarely change, prioritize speed over freshness
          // Unsplash images are immutable (URL includes unique ID)
          // =================================================================
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // =================================================================
          // EXTERNAL API - NetworkFirst (10s timeout, 24h cache)
          // REASON: Prefer fresh data but fallback to cache if server slow/offline
          // 10s timeout: External APIs may have higher latency
          // 24h cache: Menu data doesn't change frequently
          // =================================================================
          {
            urlPattern: /^https:\/\/api\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // =================================================================
          // LOCAL API - NetworkFirst (5s timeout, 1h cache)
          // REASON: Same-origin API should be fast, shorter timeout acceptable
          // 5s timeout: Local server should respond quickly
          // 1h cache: Shorter because local data may change more frequently
          // =================================================================
          {
            urlPattern: /\/api\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'local-api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // =================================================================
          // GOOGLE FONTS - CacheFirst (1 year)
          // REASON: Font files are immutable (versioned URLs), cache forever
          // =================================================================
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false, // Enable for development debugging
        type: 'module'
      }
    })
  ],
  server: {
    port: 5176
  },
  build: {
    // Build optimizations
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true
  }
})
