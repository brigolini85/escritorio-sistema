'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Maior data já mostrada por lista (sobrevive à troca de conversa e de filtro, que remontam a lista). */
const vistoAte = new Map<string, number>();

/**
 * Destaque suave (fundo que some em 1,5s; sem animação com prefers-reduced-motion) nos itens que chegaram
 * depois da última vez que esta lista foi mostrada. Cada item marca `data-realce="<data ISO>"`.
 * - Na primeira exibição nada é destacado; depois, só o que é mais novo do que tudo o que já apareceu
 *   (trocar de filtro não "destaca" itens antigos).
 * - `lembrar={false}`: a memória vale só enquanto o componente está montado (histórico: abrir a conversa de novo
 *   não destaca o que chegou enquanto a pessoa estava fora).
 * - Item com `data-realce-proprio` (o que a própria pessoa enviou, ou a conversa aberta na lista) não é destacado.
 */
export function Realce({ chave, lembrar = true, className, children }: { chave: string; lembrar?: boolean; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const local = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const itens = [...el.querySelectorAll<HTMLElement>('[data-realce]')];
    const datas = itens.map((i) => new Date(i.dataset.realce!).getTime()).filter((t) => !Number.isNaN(t));
    const maior = datas.length ? Math.max(...datas) : 0;
    const antes = lembrar ? vistoAte.get(chave) : local.current;
    if (antes !== undefined) {
      for (const i of itens) {
        if (i.hasAttribute('data-realce-proprio')) continue;
        const t = new Date(i.dataset.realce!).getTime();
        if (t > antes && !i.classList.contains('animate-realce')) {
          i.classList.add('animate-realce');
          i.addEventListener('animationend', () => i.classList.remove('animate-realce'), { once: true });
        }
      }
    }
    const novo = Math.max(antes ?? 0, maior);
    if (lembrar) vistoAte.set(chave, novo);
    else local.current = novo;
  });
  return <div ref={ref} className={className}>{children}</div>;
}
