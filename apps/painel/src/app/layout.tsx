import './globals.css';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { COOKIE_TEMA, dataThemeDoCookie } from '@/components/tema/tema';

export const metadata = { title: 'Painel do Escritório' };

// A fonte vira a variável --font-inter; tokens.css monta --font-sans a partir dela.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export default async function Raiz({ children }: { children: ReactNode }) {
  // Tema escolhido no cookie vai para o <html> já no servidor (sem piscar); sem cookie, segue o sistema.
  const tema = dataThemeDoCookie((await cookies()).get(COOKIE_TEMA)?.value);
  return (
    <html lang="pt-BR" data-theme={tema} className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
