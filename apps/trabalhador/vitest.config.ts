import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

export default defineConfig({
  test: { fileParallelism: false, testTimeout: 20_000, exclude: ['**/node_modules/**', 'src/cenarios/**'] },
});
