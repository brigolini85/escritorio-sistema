'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabaseNavegador } from '@/lib/supabase/navegador';

/** Recarrega a página quando mudam mensagens, conversas ou chamados visíveis ao usuário. */
export function AtualizarAoVivo({ conversaId }: { conversaId?: string }) {
  const router = useRouter();
  useEffect(() => {
    const sb = supabaseNavegador();
    const filtro = conversaId ? { filter: `conversa_id=eq.${conversaId}` } : {};
    const canal = sb.channel(`painel-${conversaId ?? 'caixa'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens', ...filtro }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados', ...filtro }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas', ...(conversaId ? { filter: `id=eq.${conversaId}` } : {}) }, () => router.refresh())
      .subscribe();
    return () => { void sb.removeChannel(canal); };
  }, [conversaId, router]);
  return null;
}
