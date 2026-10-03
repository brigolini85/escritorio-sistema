'use client';

import { useEffect, useState } from 'react';
import { corDaEspera, minutosDeEspera, rotuloEsperaLeitor, textoEspera, type LimitesEspera } from '@/lib/atendimento';
import { cn } from '@/lib/cn';

const CORES = { verde: 'bg-success-soft text-success', ambar: 'bg-warning-soft text-warning', vermelho: 'bg-danger-soft text-danger' } as const;

/** Cronômetro de espera (spec 7A.1): atualiza a cada 30 s; a cor sempre vem com o número e, no leitor de tela, com a frase. */
export function CronometroEspera({ desde, limites }: { desde: string; limites: LimitesEspera }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const min = minutosDeEspera(desde, agora);
  const cor = corDaEspera(min, limites);
  return (
    <span data-espera={cor} suppressHydrationWarning className={cn('tabular shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold', CORES[cor])}>
      <span aria-hidden suppressHydrationWarning>{textoEspera(min)}</span>
      <span className="sr-only" suppressHydrationWarning>{rotuloEsperaLeitor(min)}</span>
    </span>
  );
}
