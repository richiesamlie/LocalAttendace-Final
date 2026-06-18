/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  loadEnv(mode, '.', ''); // Loads .env files; values consumed via import.meta.env at runtime
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Teacher Assistant Pro',
          short_name: 'Attendance',
          description: 'Offline-First Attendance & Classroom Management',
          theme_color: '#4f46e5',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        }
      })
    ],
    define: {
      // F-027: removed dead 'process.env.GEMINI_API_KEY' define. It was
      // never referenced in src/ (verified by grep), so this was a
      // no-op build-time substitution that was also a latent leak
      // vector if anyone added a reference later.
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version ?? 'dev'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: ['**/database.json', 'database.json'],
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      exclude: ['**/node_modules/**', '**/e2e/**'],
      coverage: {
        reporter: ['text', 'html'],
        exclude: ['**/node_modules/**', '**/e2e/**', '**/*.d.ts'],
        thresholds: {
          lines: 50,
          functions: 50,
          branches: 50,
        },
      },
    },
    esbuild: {
      pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replaceAll('\\', '/');

            if (id.includes('node_modules')) {
              if (id.includes('exceljs')) return 'vendor-exceljs';
              if (id.includes('jszip')) return 'vendor-jszip';
              if (id.includes('@fast-csv') || id.includes('fast-csv')) return 'vendor-csv';
              
              if (normalizedId.includes('node_modules/lucide-react/')) return 'vendor-lucide';
              if (normalizedId.includes('node_modules/recharts/') || normalizedId.includes('node_modules/d3')) return 'vendor-recharts';
              if (normalizedId.includes('node_modules/motion/') || normalizedId.includes('node_modules/@motionone/')) return 'vendor-motion';
              if (
                normalizedId.includes('node_modules/react/') ||
                normalizedId.includes('node_modules/react-dom/') ||
                normalizedId.includes('node_modules/scheduler/')
              ) {
                return 'vendor-react';
              }

              if (
                id.includes('readable-stream') ||
                id.includes('string_decoder') ||
                id.includes('safe-buffer') ||
                id.includes('buffer') ||
                id.includes('process') ||
                id.includes('events') ||
                id.includes('inherits') ||
                id.includes('util')
              ) {
                return 'vendor-node-compat';
              }
            }

            if (normalizedId.endsWith('/src/utils/excel.ts')) {
              return 'excel-tools';
            }

            return undefined;
          },
        },
      },
    },
  };
});
