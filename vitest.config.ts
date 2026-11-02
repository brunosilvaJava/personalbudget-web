import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Tests run in Brasília time (workers inherit it), so a date parsed as UTC, the classic
// off-by-one-day bug, fails in CI too.
process.env.TZ = 'America/Sao_Paulo'

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  }),
)
