'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAgora } from '@/components/patterns/relative-time';
import { textoAtualizado } from '@/lib/inicio';

/**
 * "atualizado há 12 s · recarrega a cada minuto" (imagens A e B). `em` é a hora em que o servidor montou a página; a
 * recarga periódica traz um `em` novo. `data-hidratado` marca que o navegador assumiu (e2e: abrirInicio).
 */
export function AtualizadoHa({ em }: { em: string }) {
  const agora = useAgora(5_000);
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => setHidratado(true), []);
  const segundos = Math.max(0, (agora - new Date(em).getTime()) / 1000);
  return (
    <p data-atualizado="" data-hidratado={hidratado ? '' : undefined} className="flex items-center gap-1 text-sm text-muted">
      <RefreshCw aria-hidden size={14} strokeWidth={1.75} />
      <span suppressHydrationWarning>atualizado {textoAtualizado(segundos)}</span>
      <span aria-hidden>·</span> recarrega a cada minuto
    </p>
  );
}
