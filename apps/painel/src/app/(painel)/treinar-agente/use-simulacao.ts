import { useEffect, useState } from 'react';
import { autenticarTempoReal, supabaseNavegador } from '@/lib/supabase/navegador';
import { INTERVALO_CONSULTA_MS, PRAZO_ESPERA_MS, prazoDoTeste, type LinhaSimulacao } from './simulacao';

/** Contador das montagens de useSimulacao (sufixo do tópico do canal). */
let montagens = 0;

/**
 * Acompanha um teste: tempo real na linha da simulação (com a sessão da pessoa; o RLS só entrega as dela) e, de
 * reserva, uma consulta a cada 3 s enquanto pendente. Para em pronta/erro ou no prazo ("não respondeu a tempo").
 */
export function useSimulacao(id: string): { linha: LinhaSimulacao | null; atrasou: boolean } {
  const [linha, setLinha] = useState<LinhaSimulacao | null>(null);
  const [atrasou, setAtrasou] = useState(false);

  useEffect(() => {
    const sb = supabaseNavegador();
    let ativo = true;
    let canal: ReturnType<typeof sb.channel> | undefined;
    let prazoAjustado = false;
    let prazo: ReturnType<typeof setTimeout> | undefined;
    let consulta: ReturnType<typeof setInterval> | undefined;

    const parar = () => {
      ativo = false;
      clearInterval(consulta);
      clearTimeout(prazo);
      if (canal) void sb.removeChannel(canal);
      canal = undefined;
    };
    const ler = async (): Promise<LinhaSimulacao | null> => {
      const { data, error } = await sb.from('simulacoes_agente').select('id, status, mensagem, criado_em, respostas, erro').eq('id', id).maybeSingle();
      if (!ativo) return null;
      if (error) {
        console.error('[treinar-agente] falha ao ler o teste', error);
        return null;
      }
      if (!data) return null;
      setLinha(data);
      if (data.status !== 'pendente') parar();
      else if (!prazoAjustado) {
        // Teste retomado (já estava pendente): o prazo conta de quando ele foi criado.
        prazoAjustado = true;
        agendarPrazo(prazoDoTeste(data.criado_em, Date.now()) - Date.now());
      }
      return data;
    };
    const agendarPrazo = (ms: number) => {
      clearTimeout(prazo);
      prazo = setTimeout(() => {
        void ler().then((l) => {
          if (!ativo || (l && l.status !== 'pendente')) return;
          parar();
          setAtrasou(true);
        });
      }, ms);
    };

    agendarPrazo(PRAZO_ESPERA_MS);
    consulta = setInterval(() => void ler(), INTERVALO_CONSULTA_MS);
    void ler();
    void autenticarTempoReal(sb).then((ok) => {
      if (!ativo || !ok) return;
      // Tópico único por montagem: o canal anterior do mesmo teste pode ainda estar saindo (removeChannel é assíncrono).
      canal = sb.channel(`simulacao-${id}-${++montagens}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'simulacoes_agente', filter: `id=eq.${id}` }, () => void ler())
        .subscribe();
    });
    return parar;
  }, [id]);

  return { linha, atrasou };
}
