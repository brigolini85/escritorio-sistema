'use client';

import { Columns3, List } from 'lucide-react';
import { useTransition } from 'react';
import { cn } from '@/lib/cn';
import type { Visao } from '@/lib/demandas';
import { definirVisaoDemandas } from './acoes';
import { avisar } from './acoes-demanda';

/** TABELA / QUADRO (imagem 03, canto direito). A escolha fica no perfil: vale em qualquer computador. */
export function AlternarVisao({ atual }: { atual: Visao }) {
  const [pendente, iniciar] = useTransition();
  const escolher = (v: Visao) => {
    if (v === atual) return;
    iniciar(async () => {
      const r = await definirVisaoDemandas(v);
      if (!r.ok) avisar(r);
    });
  };
  return (
    <div role="group" aria-label="Visão das demandas" className="inline-flex overflow-hidden rounded-md border border-input print:hidden">
      {(['tabela', 'quadro'] as const).map((v) => {
        const Icone = v === 'tabela' ? List : Columns3;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={atual === v}
            disabled={pendente}
            onClick={() => escolher(v)}
            className={cn(
              'inline-flex h-9 items-center gap-2 px-3 text-sm font-bold uppercase tracking-wide transition-colors duration-150 ease-out',
              atual === v ? 'bg-grafite text-grafite-foreground' : 'bg-surface text-foreground hover:bg-surface-muted',
            )}
          >
            <Icone aria-hidden size={16} strokeWidth={1.75} />
            {v === 'tabela' ? 'Tabela' : 'Quadro'}
          </button>
        );
      })}
    </div>
  );
}
