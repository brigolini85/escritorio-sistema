import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/principal.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  // Os pacotes do monorepo são código TypeScript: entram no pacote final em vez de serem importados.
  noExternal: [/^@escritorio\//],
});
