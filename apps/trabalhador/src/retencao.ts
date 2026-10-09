import type { Db, Repos } from '@escritorio/db';
import { naVez } from './fila';
import type { ArmazenamentoMidia } from './midia/armazenamento';

const LOTE = 500;

/** Auditoria 4.17: a limpeza tem trava própria de 2 h; uma segunda limpeza (nova tentativa do pg-boss) sai sem limpar. */
export const TRAVA_LIMPEZA = { chave: 'limpeza-retencao', segundos: 2 * 60 * 60 } as const;

export async function limpezaNaVez<T>(
  repos: Pick<Repos, 'pegarTrava' | 'soltarTrava' | 'renovarTrava'>, limpar: () => Promise<T>,
): Promise<T | 'ocupada'> {
  return naVez(repos, TRAVA_LIMPEZA.chave, TRAVA_LIMPEZA.segundos, limpar,
    async () => { console.log('[retenção] outra limpeza em andamento; esta sai'); });
}

/**
 * Conversas, anexos e decisões do agente e as conversas com o assistente interno ficam guardados por 1 ano (spec, seção 9);
 * os testes do agente (simulacoes_agente), 30 dias; as sugestões de resposta, 1 dia.
 */
export async function limparRetencao(db: Db, midia: ArmazenamentoMidia, agora = new Date()) {
  const limite = new Date(agora);
  limite.setFullYear(limite.getFullYear() - 1);
  const corte = limite.toISOString();
  let mensagens = 0;
  let arquivos = 0;
  for (;;) {
    const { data, error } = await db.from('mensagens').select('id, arquivo_path').lt('criado_em', corte).limit(LOTE);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    const paths = data.map((m) => m.arquivo_path).filter((p): p is string => Boolean(p));
    await midia.remover(paths);
    const { error: e2 } = await db.from('mensagens').delete().in('id', data.map((m) => m.id));
    if (e2) throw new Error(e2.message);
    mensagens += data.length;
    arquivos += paths.length;
  }
  const { data: decisoes, error: e3 } = await db.from('decisoes_agente').delete().lt('criado_em', corte).select('id');
  if (e3) throw new Error(e3.message);
  const { data: assistente, error: e4 } = await db.from('assistente_mensagens').delete().lt('criado_em', corte).select('id');
  if (e4) throw new Error(e4.message);
  // Testes do agente (Treinar o agente) ficam só 30 dias.
  const limiteSimulacoes = new Date(agora.getTime() - 30 * 24 * 60 * 60_000).toISOString();
  const { data: simulacoes, error: e5 } = await db.from('simulacoes_agente').delete().lt('criado_em', limiteSimulacoes).select('id');
  if (e5) throw new Error(e5.message);
  // Sugestões de resposta (Atendimento) ficam só 1 dia (P11): são rascunhos de quem pediu.
  const limiteSugestoes = new Date(agora.getTime() - 24 * 60 * 60_000).toISOString();
  const { data: sugestoes, error: e6 } = await db.from('sugestoes_resposta').delete().lt('criado_em', limiteSugestoes).select('id');
  if (e6) throw new Error(e6.message);
  return { mensagens, arquivos, decisoes: decisoes?.length ?? 0, assistente: assistente?.length ?? 0, simulacoes: simulacoes?.length ?? 0,
    sugestoes: sugestoes?.length ?? 0 };
}
