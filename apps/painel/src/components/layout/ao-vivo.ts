'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { estadoPelaPausaGeral as estadoDoAgente, type EstadoAgente } from '@/components/patterns/estado-agente';
import { toast } from '@/components/ui/toaster';
import { contarConversasAguardando, contarDemandasAbertas, deveAvisarNovaConversa, lerAgentePausado } from '@/lib/contadores';
import { autenticarTempoReal, supabaseNavegador } from '@/lib/supabase/navegador';
import type { Contadores } from './sidebar';

const ESPERA_EVENTOS_MS = 500;
const RELEITURA_AGENTE_MS = 60_000;

/**
 * Contadores do menu e estado do agente ao vivo, sem recarregar a página:
 * - evento de tempo real em conversas/chamados visíveis → relê só as duas contagens pelo navegador (RLS);
 * - estado do agente (só quem lê configuracoes): configuracoes não está na publicação do tempo real,
 *   então é relido junto com os eventos, ao voltar para a aba e a cada minuto;
 * - valores novos vindos do servidor (server action que revalida, navegação) substituem os locais.
 * Aviso "Nova conversa aguardando atendimento" só quando o aumento veio de um evento de tempo real
 * e a pessoa não acabou de agir (enviar formulário ou navegar nos últimos segundos).
 */
export function useAoVivo(inicial: { contadores: Contadores; estadoAgente: EstadoAgente | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [contadores, setContadores] = useState(inicial.contadores);
  const [estadoAgente, setEstadoAgente] = useState(inicial.estadoAgente);
  const atual = useRef(inicial.contadores);
  const ultimaAcao = useRef(0);
  const leAgente = inicial.estadoAgente !== null;

  // Valores do servidor mandam (o layout re-renderiza depois de server actions que revalidam).
  const { atendimento, demandas } = inicial.contadores;
  useEffect(() => {
    atual.current = { atendimento, demandas };
    setContadores({ atendimento, demandas });
  }, [atendimento, demandas]);
  const tipoAgente = inicial.estadoAgente?.tipo;
  useEffect(() => {
    setEstadoAgente(tipoAgente ? estadoDoAgente(tipoAgente === 'pausado') : null);
  }, [tipoAgente]);

  // Ação da própria pessoa: aumento logo em seguida não é "conversa nova".
  const rotaAnterior = useRef(pathname);
  useEffect(() => {
    // Carregar a página não é ação; trocar de página é.
    if (rotaAnterior.current === pathname) return;
    rotaAnterior.current = pathname;
    ultimaAcao.current = Date.now();
  }, [pathname]);
  useEffect(() => {
    const marcar = () => { ultimaAcao.current = Date.now(); };
    document.addEventListener('submit', marcar, true);
    return () => document.removeEventListener('submit', marcar, true);
  }, []);

  useEffect(() => {
    const sb = supabaseNavegador();
    let ativo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    let canal: ReturnType<typeof sb.channel> | undefined;

    async function reler(origem: 'tempo-real' | 'aba') {
      let a: number | null;
      let d: number | null;
      let p: boolean | null;
      try {
        [a, d, p] = await Promise.all([
          contarConversasAguardando(sb),
          contarDemandasAbertas(sb),
          leAgente ? lerAgentePausado(sb) : Promise.resolve(null),
        ]);
      } catch (e) {
        // Rede fora ou erro inesperado: mantém os números da tela e continua ouvindo os próximos eventos.
        console.error('[casca] falha ao reler contadores', e);
        return;
      }
      if (!ativo) return;
      const antes = atual.current;
      const novo = { atendimento: a ?? antes.atendimento, demandas: d ?? antes.demandas };
      atual.current = novo;
      setContadores(novo);
      if (leAgente && p !== null) setEstadoAgente(estadoDoAgente(p));
      if (origem === 'tempo-real' && deveAvisarNovaConversa(antes.atendimento, novo.atendimento, Date.now() - ultimaAcao.current)) {
        toast('Nova conversa aguardando atendimento', {
          action: { label: 'Abrir', onClick: () => router.push('/atendimento?filtro=sem_responsavel') },
        });
      }
    }

    const agendar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => void reler('tempo-real'), ESPERA_EVENTOS_MS);
    };
    void autenticarTempoReal(sb).then((ok) => {
      if (!ativo || !ok) return;
      canal = sb.channel('painel-casca')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas' }, agendar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados' }, agendar)
        .subscribe();
    });

    const aoVoltar = () => { if (document.visibilityState === 'visible') void reler('aba'); };
    document.addEventListener('visibilitychange', aoVoltar);
    const intervalo = leAgente ? setInterval(() => void reler('aba'), RELEITURA_AGENTE_MS) : undefined;

    return () => {
      ativo = false;
      clearTimeout(espera);
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltar);
      if (canal) void sb.removeChannel(canal);
    };
  }, [leAgente, router]);

  return { contadores, estadoAgente };
}
