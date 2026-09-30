'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { autenticarTempoReal, supabaseNavegador } from '@/lib/supabase/navegador';

/** Rajada de eventos (mensagem + conversa + demanda da mesma ação) vira uma recarga só. */
const ESPERA_MS = 300;

/**
 * Recarrega a página quando mudam mensagens, conversas ou chamados visíveis ao usuário (e, com `assistenteDe`, a conversa com o assistente).
 * Sem `conversaId`, ouve tudo o que o RLS libera (a lista de conversas aparece também ao lado da conversa aberta).
 */
export function AtualizarAoVivo({ conversaId, assistenteDe }: { conversaId?: string; assistenteDe?: string }) {
  const router = useRouter();
  useEffect(() => {
    const sb = supabaseNavegador();
    const filtro = conversaId ? { filter: `conversa_id=eq.${conversaId}` } : {};
    let ativo = true;
    let canal: ReturnType<typeof sb.channel> | undefined;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => router.refresh(), ESPERA_MS);
    };
    // A sessão vai para o tempo real antes de assinar; senão o canal entra como anônimo e o RLS não entrega eventos.
    void autenticarTempoReal(sb).then((ok) => {
      if (!ativo || !ok) return;
      canal = sb.channel(`painel-${conversaId ?? 'caixa'}-${assistenteDe ?? ''}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens', ...filtro }, recarregar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados', ...filtro }, recarregar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas', ...(conversaId ? { filter: `id=eq.${conversaId}` } : {}) }, recarregar);
      if (assistenteDe) {
        canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: 'assistente_mensagens', filter: `usuario_id=eq.${assistenteDe}` }, recarregar);
      }
      canal.subscribe();
    });
    return () => {
      ativo = false;
      clearTimeout(espera);
      if (canal) void sb.removeChannel(canal);
    };
  }, [conversaId, assistenteDe, router]);
  return null;
}
