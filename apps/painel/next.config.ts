import { existsSync } from 'node:fs';
import type { NextConfig } from 'next';

// O .env fica na raiz do monorepo; o Next só lê o da pasta do app. Em produção as variáveis vêm do ambiente.
const envRaiz = new URL('../../.env', import.meta.url);
if (existsSync(envRaiz)) process.loadEnvFile(envRaiz);

const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@escritorio/core', '@escritorio/db'],
  serverExternalPackages: ['pg-boss'],
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
};
export default config;
