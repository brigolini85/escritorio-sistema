import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import { CABECALHOS_FIXOS } from './src/lib/cabecalhos-seguranca';

// O .env fica na raiz do monorepo; o Next só lê o da pasta do app. Em produção as variáveis vêm do ambiente.
const envRaiz = new URL('../../.env', import.meta.url);
if (existsSync(envRaiz)) process.loadEnvFile(envRaiz);

const config: NextConfig = {
  output: 'standalone',
  // Raiz do monorepo: o build standalone precisa incluir os pacotes @escritorio/*.
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  transpilePackages: ['@escritorio/core', '@escritorio/db'],
  serverExternalPackages: ['pg-boss'],
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
  // Indicador do Next (só em desenvolvimento) no canto direito: no esquerdo ele cobre o "Recolher" do menu.
  devIndicators: { position: 'bottom-right' },
  // Segurança do login (item 6): valem para todas as respostas, inclusive arquivos estáticos. A CSP (com nonce por
  // pedido) e o HSTS (só produção em https) saem do middleware.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: CABECALHOS_FIXOS }];
  },
};
export default config;
