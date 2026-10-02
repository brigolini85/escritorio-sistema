import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { COOKIE_LETRA, classeDoTamanho, tamanhoDoValor } from '@/components/layout/tamanho-letra';
import { COOKIE_TEMA, dataThemeDoCookie } from '@/components/tema/tema';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Painel do Escritório' };

// Sem lista de pesos o next/font carrega a fonte variável inteira (inclui o 600 do font-semibold).
// A fonte vira a variável --font-jakarta; tokens.css monta --font-sans a partir dela.
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export default async function Raiz({ children }: { children: ReactNode }) {
  // Tema escolhido no cookie vai para o <html> já no servidor (sem piscar); sem cookie, segue o sistema.
  const loja = await cookies();
  const tema = dataThemeDoCookie(loja.get(COOKIE_TEMA)?.value);
  // Tamanho da letra também vem do cookie, para a classe já estar no <html> do servidor.
  const letra = classeDoTamanho(tamanhoDoValor(loja.get(COOKIE_LETRA)?.value));
  return (
    <html lang="pt-BR" data-theme={tema} className={cn(jakarta.variable, letra)}>
      <body>{children}</body>
    </html>
  );
}
