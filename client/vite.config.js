import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // /api দিয়ে শুরু হওয়া কল ব্যাকএন্ডে পাঠাবে
      '/api': 'http://localhost:4000',
    },
  },
});
