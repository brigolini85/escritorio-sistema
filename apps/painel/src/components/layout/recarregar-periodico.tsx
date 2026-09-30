'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { deveRecarregar, RECARGA_AO_VOLTAR_MS, RECARGA_PERIODICA_MS, TIQUE_RECARGA_MS } from '@/lib/recarga';

/**
 * Recarrega a página (`router.refresh()`) a cada minuto com a aba visível e ao voltar para a aba, para sinais de
 * vida, alertas e números do dia não ficarem com o valor do carregamento (falso "parado"). Estado de cliente
 * (campos digitados, janelas abertas) continua: o refresh só troca o que vem do servidor. Regra em lib/recarga.ts.
 */
export function RecarregarPeriodico() {
  const router = useRouter();
  const ultima = useRef(0);
  useEffect(() => {
    ultima.current = Date.now();
    const tentar = (minimoMs: number) => {
      const agora = Date.now();
      if (!deveRecarregar({ visivel: document.visibilityState === 'visible', desdeUltimaMs: agora - ultima.current, minimoMs })) return;
      ultima.current = agora;
      router.refresh();
    };
    const id = setInterval(() => tentar(RECARGA_PERIODICA_MS), TIQUE_RECARGA_MS);
    const aoVoltar = () => tentar(RECARGA_AO_VOLTAR_MS);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [router]);
  return null;
}
