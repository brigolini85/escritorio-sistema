'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabaseNavegador } from '@/lib/supabase/navegador';

/** Recarrega a página quando mudam mensagens, conversas ou chamados visíveis ao usuário (e, com `assistenteDe`, a conversa com o assistente). */
export function AtualizarAoVivo({ conversaId, assistenteDe }: { conversaId?: string; assistenteDe?: string }) {
  const router = useRouter();
  useEffect(() => {
    const sb = supabaseNavegador();
    const filtro = conversaId ? { filter: `conversa_id=eq.${conversaId}` } : {};
    let canal = sb.channel(`painel-${conversaId ?? 'caixa'}-${assistenteDe ?? ''}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens', ...filtro }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados', ...filtro }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas', ...(conversaId ? { filter: `id=eq.${conversaId}` } : {}) }, () => router.refresh());
    if (assistenteDe) {
      canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: 'assistente_mensagens', filter: `usuario_id=eq.${assistenteDe}` }, () => router.refresh());
    }
    canal.subscribe();
    return () => { void sb.removeChannel(canal); };
  }, [conversaId, assistenteDe, router]);
  return null;
}
