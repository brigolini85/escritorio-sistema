'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { marcarLida } from '../acoes';

/** Abrir a conversa (e cada atualização ao vivo com a aba visível) marca como lida até a última mensagem mostrada. */
export function MarcarLida({ conversaId, ate }: { conversaId: string; ate: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!ate) return;
    let ativo = true;
    const marcar = () => {
      if (document.hidden) return;
      void marcarLida(conversaId, ate).then((mudou) => { if (ativo && mudou) router.refresh(); }).catch(() => undefined);
    };
    marcar();
    document.addEventListener('visibilitychange', marcar);
    return () => {
      ativo = false;
      document.removeEventListener('visibilitychange', marcar);
    };
  }, [conversaId, ate, router]);
  return null;
}
