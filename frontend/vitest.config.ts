import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // devcontainer (WSL2) のリソース枯渇を防ぐためワーカー数を制限する。
    // CI (GitHub Actions) では制限なしで実行される。
    ...(!process.env.CI && {
      pool: 'threads',
      poolOptions: {
        threads: {
          maxThreads: 2,
        },
      },
    }),
    // @mui/x-date-pickers の ESM モジュールをインライン変換する。
    // jsdom 環境では ESM ディレクトリインポートが解決できないため、vitest に変換させる。
    server: {
      deps: {
        inline: ['@mui/x-date-pickers'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', 'dist/'],
    },
  },
});
