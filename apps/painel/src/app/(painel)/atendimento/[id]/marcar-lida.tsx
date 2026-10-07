'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabaseNavegador } from '@/lib/supabase/navegador';

/**
 * Abrir a conversa (e cada atualização ao vivo com a aba visível) marca como lida até a última mensagem mostrada.
 * Vai direto ao banco pelo navegador (a RPC confere o acesso pela RLS e pelo horário), sem passar pelo servidor do
 * painel: é automático e não pode contar como uso para a regra de 1 h sem uso (sessao-limites.ts).
 */
export function MarcarLida({ conversaId, ate }: { conversaId: string; ate: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!ate) return;
    let ativo = true;
    const marcar = () => {
      if (document.hidden) return;
      void supabaseNavegador().rpc('marcar_conversa_lida', { p_conversa: conversaId, p_ate: ate })
        .then(({ data, error }) => {
          if (error) console.error('marcar_conversa_lida falhou:', error.message);
          else if (ativo && data) router.refresh();
        });
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
