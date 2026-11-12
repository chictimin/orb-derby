import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// 2페이지: index.html(진행자) + join.html(QR 참가). base './'는 GitHub Pages 하위 경로 대비.
export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), join: resolve(__dirname, 'join.html') } },
  },
});
