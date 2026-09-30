'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export type SecaoConfiguracao = { id: string; rotulo: string };

/**
 * Navegação interna de Configurações: links para as âncoras das seções (#expediente, #setores…), com a seção que
 * está na tela marcada (aria-current). No celular vira uma fileira que rola na horizontal, acima dos cards.
 */
export function NavegacaoSecoes({ secoes }: { secoes: SecaoConfiguracao[] }) {
  const [atual, setAtual] = useState<string | null>(secoes[0]?.id ?? null);

  useEffect(() => {
    const doHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (secoes.some((s) => s.id === id)) setAtual(id);
    };
    doHash();
    const visiveis = new Map<string, number>();
    const observador = new IntersectionObserver((entradas) => {
      for (const e of entradas) visiveis.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : Infinity);
      // A primeira seção (na ordem da página) que ainda aparece na parte de cima da tela.
      const primeira = secoes.find((s) => (visiveis.get(s.id) ?? Infinity) !== Infinity);
      if (primeira) setAtual(primeira.id);
    }, { rootMargin: '-80px 0px -55% 0px' });
    for (const s of secoes) {
      const el = document.getElementById(s.id);
      if (el) observador.observe(el);
    }
    window.addEventListener('hashchange', doHash);
    return () => {
      observador.disconnect();
      window.removeEventListener('hashchange', doHash);
    };
  }, [secoes]);

  return (
    <nav aria-label="Seções das configurações" className="-mx-1 overflow-x-auto lg:sticky lg:abaixo-cabecalho lg:mx-0 lg:w-48 lg:shrink-0 lg:overflow-visible">
      <ul className="flex gap-1 px-1 lg:flex-col lg:px-0">
        {secoes.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={atual === s.id ? 'location' : undefined}
              onClick={() => setAtual(s.id)}
              className={cn(
                'flex h-8 items-center whitespace-nowrap rounded-md px-3 text-base text-muted transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground',
                atual === s.id && 'bg-brand-soft font-medium text-brand hover:bg-brand-soft hover:text-brand',
              )}
            >
              {s.rotulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
