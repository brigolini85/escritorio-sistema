'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { autenticarTempoReal, supabaseNavegador } from '@/lib/supabase/navegador';

/** Evento da conversa aberta (ou do assistente da pessoa): recarrega quase na hora, juntando só a mesma rajada. */
const ESPERA_ABERTA_MS = 150;
/** Evento de outra conversa (só a lista muda): espera a rajada acabar... */
const ESPERA_OUTRAS_MS = 1000;
/** ...mas nunca mais que isto desde o primeiro evento pendente, mesmo com eventos seguidos. */
const ESPERA_MAXIMA_MS = 3000;

type Mudanca = { new?: Record<string, unknown> | null; old?: Record<string, unknown> | null };

/**
 * Recarrega a página quando mudam mensagens, conversas ou chamados visíveis ao usuário (e, com `assistenteDe`,
 * a conversa dele com o assistente). Ouve tudo o que o RLS libera, porque a lista de conversas aparece também ao
 * lado da conversa aberta; eventos da conversa aberta (`conversaAberta`) recarregam logo, os outros esperam.
 * Com a aba escondida não recarrega nada: marca pendente e recarrega ao voltar.
 */
export function AtualizarAoVivo({ conversaAberta, assistenteDe }: { conversaAberta?: string; assistenteDe?: string }) {
  const router = useRouter();
  useEffect(() => {
    const sb = supabaseNavegador();
    let ativo = true;
    let canal: ReturnType<typeof sb.channel> | undefined;
    let espera: ReturnType<typeof setTimeout> | undefined;
    let primeiroPendente = 0;
    let prazoAtual = 0;
    let urgentePendente = false;
    let pendenteEscondido = false;

    const recarregar = () => {
      clearTimeout(espera);
      espera = undefined;
      primeiroPendente = 0;
      urgentePendente = false;
      router.refresh();
    };
    const agendar = (urgente: boolean) => {
      if (document.hidden) {
        pendenteEscondido = true;
        return;
      }
      const agora = Date.now();
      if (!primeiroPendente) primeiroPendente = agora;
      // Um evento da conversa aberta nunca fica esperando por causa de eventos de outras conversas.
      const quando = Math.min(agora + (urgente ? ESPERA_ABERTA_MS : ESPERA_OUTRAS_MS), primeiroPendente + ESPERA_MAXIMA_MS);
      if (!espera) prazoAtual = quando;
      else if (urgente || urgentePendente) prazoAtual = Math.min(prazoAtual, quando);
      else prazoAtual = quando; // outras conversas: espera a rajada acabar (até o máximo)
      urgentePendente ||= urgente;
      clearTimeout(espera);
      espera = setTimeout(recarregar, Math.max(0, prazoAtual - agora));
    };
    const daConversa = (campo: string) => (p: Mudanca) => {
      const id = p.new?.[campo] ?? p.old?.[campo];
      agendar(Boolean(conversaAberta) && id === conversaAberta);
    };
    const aoMudarVisibilidade = () => {
      if (!document.hidden && pendenteEscondido) {
        pendenteEscondido = false;
        recarregar();
      }
    };
    document.addEventListener('visibilitychange', aoMudarVisibilidade);

    // A sessão vai para o tempo real antes de assinar; senão o canal entra como anônimo e o RLS não entrega eventos.
    void autenticarTempoReal(sb).then((ok) => {
      if (!ativo || !ok) return;
      canal = sb.channel(`painel-caixa-${conversaAberta ?? ''}-${assistenteDe ?? ''}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, daConversa('conversa_id'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados' }, daConversa('conversa_id'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas' }, daConversa('id'));
      if (assistenteDe) {
        canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: 'assistente_mensagens', filter: `usuario_id=eq.${assistenteDe}` }, () => agendar(true));
      }
      canal.subscribe();
    });
    return () => {
      ativo = false;
      clearTimeout(espera);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      if (canal) void sb.removeChannel(canal);
    };
  }, [conversaAberta, assistenteDe, router]);
  return null;
}
