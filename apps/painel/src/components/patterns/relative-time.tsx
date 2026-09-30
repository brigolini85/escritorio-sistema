'use client';

import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { formatarDataHora, isoOuNulo, tempoRelativo } from '@/lib/formatos';

/** Hora atual que se atualiza sozinha (padrão: a cada 30s), para textos "há 3 min" não ficarem velhos. */
export function useAgora(intervaloMs = 30_000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

/**
 * "há 3 min", com a data completa no horário de Brasília no tooltip ("30/09/2026 às 14:05").
 * `focavel`: entra na ordem do Tab para o tooltip abrir pelo teclado (evite em listas longas).
 */
export function RelativeTime({ data, focavel = false, className }: { data: string | Date; focavel?: boolean; className?: string }) {
  const agora = useAgora();
  const iso = isoOuNulo(data);
  // Data ruim no banco não derruba a tela: mostra um traço.
  if (!iso) return <span className={cn('text-subtle', className)}>—</span>;
  const completa = formatarDataHora(iso);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={iso}
          tabIndex={focavel ? 0 : undefined}
          aria-label={focavel ? `${tempoRelativo(iso, agora)}, ${completa}` : undefined}
          className={cn('tabular whitespace-nowrap', className)}
          suppressHydrationWarning
        >
          {tempoRelativo(iso, agora)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{completa} (horário de Brasília)</TooltipContent>
    </Tooltip>
  );
}
