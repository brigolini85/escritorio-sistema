'use client';

import { Check, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { BLOCOS, textoEstado, type Bloco, type EstadoBloco } from './ficha';

/** Índice da ficha (D28): um link por bloco, o da tela marcado, e o estado sempre escrito (a cor nunca fala sozinha). */
export function IndiceFicha({ estados }: { estados: Record<Bloco, EstadoBloco> }) {
  const [ativo, setAtivo] = useState<Bloco>('identificacao');
  useEffect(() => {
    const secoes = BLOCOS.map((b) => document.getElementById(`bloco-${b.id}`)).filter((s): s is HTMLElement => s !== null);
    const observador = new IntersectionObserver((entradas) => {
      const primeira = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const id = primeira?.target.getAttribute('data-bloco') as Bloco | null | undefined;
      if (id) setAtivo(id);
    }, { rootMargin: '0px 0px -60% 0px' });
    secoes.forEach((s) => observador.observe(s));
    return () => observador.disconnect();
  }, []);

  return (
    <nav aria-label="Blocos da ficha" className="sticky top-4 hidden w-indice-ficha shrink-0 self-start rounded-lg border border-border bg-surface p-2 lg:block">
      <ul className="flex flex-col gap-0.5">
        {BLOCOS.map((b) => (
          <li key={b.id}>
            <a href={`#bloco-${b.id}`} onClick={() => setAtivo(b.id)} aria-current={ativo === b.id ? 'true' : undefined}
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
