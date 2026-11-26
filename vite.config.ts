import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Servi depuis https://gaetandg.github.io/JeuEnigmes3D/
  base: process.env.GITHUB_ACTIONS ? '/JeuEnigmes3D/' : './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
