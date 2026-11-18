import { defineConfig } from 'vite-plus';
import { cloudflare } from '@cloudflare/vite-plugin';
export default defineConfig({
  plugins: [cloudflare()],
  optimizeDeps: { entries: ['index.html'] },
  lint: {
    categories: { correctness: 'error' },
    env: { browser: true, node: true },
    ignorePatterns: ['cc-docs/**', 'dist/**', '.cloudflare/**'],
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    singleQuote: true,
    ignorePatterns: ['cc-docs/**', 'dist/**', '.cloudflare/**', 'pnpm-lock.yaml'],
  },
  server: {
    host: '0.0.0.0',
    fs: { allow: ['index.html', 'src', 'public', 'node_modules'] },
  },
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['tests/vitest.test.ts'] },
});
