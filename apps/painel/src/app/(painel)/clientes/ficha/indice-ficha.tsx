'use client';

import { Check, Lock } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import { BLOCOS, textoEstado, type Bloco, type EstadoBloco } from './ficha';

/** Índice da ficha (D28): um link por bloco, o da tela marcado, e o estado sempre escrito (a cor nunca fala sozinha). */
export function IndiceFicha({ estados, ocultar = [] }: { estados: Record<Bloco, EstadoBloco>; ocultar?: Bloco[] }) {
  const [ativo, setAtivo] = useState<Bloco>('identificacao');
  useEffect(() => {
    const secoes = BLOCOS.filter((b) => !ocultar.includes(b.id)).map((b) => document.getElementById(`bloco-${b.id}`)).filter((s): s is HTMLElement => s !== null);
    const observador = new IntersectionObserver((entradas) => {
      const primeira = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const id = primeira?.target.getAttribute('data-bloco') as Bloco | null | undefined;
      if (id) setAtivo(id);
    }, { rootMargin: '0px 0px -60% 0px' });
    secoes.forEach((s) => observador.observe(s));
    return () => observador.disconnect();
  }, [ocultar.join()]);

  /**
   * Rola até o bloco e leva o foco ao título dele (tabIndex -1): o próximo Tab segue dentro do bloco. O # puro do navegador
   * só rolava e deixava o foco no body. O endereço ganha o # como antes, sem entrada nova no histórico.
   */
  const irPara = (e: MouseEvent<HTMLAnchorElement>, id: Bloco) => {
    const secao = document.getElementById(`bloco-${id}`);
    const titulo = document.getElementById(`titulo-${id}`);
    if (!secao || !titulo) return;
    e.preventDefault();
    setAtivo(id);
    secao.scrollIntoView({ block: 'start' });
    titulo.focus({ preventScroll: true });
    history.replaceState(history.state, '', `#bloco-${id}`);
  };

  return (
    <nav aria-label="Blocos da ficha" className="sticky top-4 hidden w-indice-ficha shrink-0 self-start rounded-lg border border-border bg-surface p-2 lg:block">
      <ul className="flex flex-col gap-0.5">
        {BLOCOS.filter((b) => !ocultar.includes(b.id)).map((b) => (
          <li key={b.id}>
            <a href={`#bloco-${b.id}`} onClick={(e) => irPara(e, b.id)} aria-current={ativo === b.id ? 'true' : undefined}
              className={cn('flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-muted',
                ativo === b.id && 'bg-brand-soft font-bold text-brand')}>
              <span>{b.rotulo}</span>
              <Marca estado={estados[b.id]} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Marca({ estado }: { estado: EstadoBloco }) {
  const texto = textoEstado(estado);
  switch (estado.tipo) {
    case 'completo':
      return <span className="flex items-center text-success"><Check aria-hidden size={14} strokeWidth={2} /><span className="sr-only">{texto}</span></span>;
    case 'protegido':
      return <span className="flex items-center text-muted"><Lock aria-hidden size={14} strokeWidth={1.75} /><span className="sr-only">{texto}</span></span>;
    case 'vencido':
      return <span className="text-xs font-extrabold uppercase text-danger">{texto}</span>;
    case 'pendente':
    case 'vence':
      return <span className="text-xs font-extrabold uppercase text-warning">{texto}</span>;
    default:
      return null;
  }
}
