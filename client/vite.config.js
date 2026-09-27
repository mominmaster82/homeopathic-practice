import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA: অ্যাপ-শেল (HTML/JS/CSS/আইকন) সার্ভিস ওয়ার্কারে প্রি-ক্যাশ হয়,
    // ফলে ইন্টারনেট না থাকলেও অ্যাপ লোড হয়; ডেটা-অফলাইন Firestore পার্সিসটেন্স সামলায়।
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'হোমিওপ্যাথিক সফটওয়্যার',
        short_name: 'হোমিওপ্যাথি',
        description:
          'হোমিওপ্যাথিক ক্লিনিক ব্যবস্থাপনা — রোগী, কেস, রেপার্টরি, ম্যাটেরিয়া মেডিকা ও প্রেসক্রিপশন',
        lang: 'bn',
        start_url: '/',
        display: 'standalone',
        theme_color: '#0d9488',
        background_color: '#f1f5f9',
        icons: [
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // /api দিয়ে শুরু হওয়া কল ব্যাকএন্ডে পাঠাবে
      '/api': 'http://localhost:4000',
    },
  },
});
