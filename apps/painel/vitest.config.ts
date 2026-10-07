import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// "@/" como no tsconfig (testes de server actions importam módulos do painel pelo apelido).
export default defineConfig({
  // Testes que chamam componentes de servidor (.tsx) direto: JSX do React 17+ sem precisar importar React.
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'] },
});
