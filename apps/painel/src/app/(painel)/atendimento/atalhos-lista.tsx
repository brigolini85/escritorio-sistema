'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ignorarAtalho } from '@/components/layout/atalhos';

/**
 * J/K: próxima/anterior conversa da lista (mantendo filtro e busca, que estão no href de cada item).
 * Na lista sem conversa aberta, J ou K abre a primeira.
 */
export function AtalhosLista() {
  const router = useRouter();
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const tecla = e.key.toLowerCase();
      if ((tecla !== 'j' && tecla !== 'k') || ignorarAtalho(e)) return;
      // Itens dentro de um grupo recolhido ("Concluídas hoje" fechado) não estão à vista: J/K passam por cima.
      const itens = [...document.querySelectorAll<HTMLAnchorElement>('a[data-conversa-item]')]
        .filter((a) => a.closest('details:not([open])') === null || a.getAttribute('aria-current') === 'page');
      if (!itens.length) return;
      const atual = itens.findIndex((a) => a.getAttribute('aria-current') === 'page');
      const destino = atual < 0 ? itens[0] : itens[Math.min(Math.max(atual + (tecla === 'j' ? 1 : -1), 0), itens.length - 1)];
      if (!destino || destino === itens[atual]) return;
      e.preventDefault();
      destino.scrollIntoView({ block: 'nearest' });
      router.push(destino.getAttribute('href')!, { scroll: false });
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [router]);
  return null;
}
