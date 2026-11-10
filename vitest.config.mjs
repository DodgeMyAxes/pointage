import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Les calculs se font en heure locale : fuseau fixé pour que les tests (changements d'heure compris) soient reproductibles.
    env: { TZ: 'Europe/Paris' },
  },
})
