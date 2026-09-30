'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Maior data já mostrada por lista (sobrevive à troca de conversa e de filtro, que remontam a lista). */
const vistoAte = new Map<string, number>();

/**
 * Destaque suave (fundo que some em 1,5s; sem animação com prefers-reduced-motion) nos itens que chegaram
 * depois da última vez que esta lista foi mostrada. Cada item marca `data-realce="<data ISO>"`.
 * Na primeira vez nada é destacado; depois, só o que é mais novo do que tudo o que já apareceu
 * (trocar de filtro não "destaca" itens antigos).
 */
export function Realce({ chave, className, children }: { chave: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const itens = [...el.querySelectorAll<HTMLElement>('[data-realce]')];
    const datas = itens.map((i) => new Date(i.dataset.realce!).getTime()).filter((t) => !Number.isNaN(t));
    const maior = datas.length ? Math.max(...datas) : 0;
    const antes = vistoAte.get(chave);
    if (antes !== undefined) {
      for (const i of itens) {
        const t = new Date(i.dataset.realce!).getTime();
        if (t > antes && !i.classList.contains('animate-realce')) {
          i.classList.add('animate-realce');
          i.addEventListener('animationend', () => i.classList.remove('animate-realce'), { once: true });
        }
      }
    }
    vistoAte.set(chave, Math.max(antes ?? 0, maior));
  });
  return <div ref={ref} className={className}>{children}</div>;
}
