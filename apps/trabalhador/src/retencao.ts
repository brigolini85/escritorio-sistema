import type { Db, Repos } from '@escritorio/db';
import type { Alertas } from './alertas';
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

export type ResultadoLimpeza = { mensagens: number; arquivos: number; decisoes: number; assistente: number; simulacoes: number; sugestoes: number };

/** Auditoria 6.5: uma ou mais etapas falharam; as outras rodaram e `parcial` tem o que elas apagaram. */
export class ErroLimpeza extends Error {
  constructor(readonly parcial: ResultadoLimpeza, readonly falhas: { etapa: keyof ResultadoLimpeza; erro: string }[]) {
    super(`Limpeza com falha em ${falhas.map((f) => `${f.etapa} (${f.erro})`).join('; ')}`);
  }
}

/**
 * Conversas, anexos e decisões do agente e as conversas com o assistente interno ficam guardados por 1 ano (spec, seção 9);
 * os testes do agente (simulacoes_agente), 30 dias; as sugestões de resposta, 1 dia.
 * Auditoria 6.5: cada etapa no seu try; a falha de uma não trava as outras. Com falha, ErroLimpeza no fim (com as contagens).
 */
export async function limparRetencao(db: Db, midia: ArmazenamentoMidia, agora = new Date()): Promise<ResultadoLimpeza> {
  const limite = new Date(agora);
  limite.setFullYear(limite.getFullYear() - 1);
  const corte = limite.toISOString();
  const r: ResultadoLimpeza = { mensagens: 0, arquivos: 0, decisoes: 0, assistente: 0, simulacoes: 0, sugestoes: 0 };
  const falhas: ErroLimpeza['falhas'] = [];
  const etapa = async (nome: keyof ResultadoLimpeza, f: () => Promise<void>) => {
    try {
      await f();
    } catch (e) {
      console.error(`[retenção] etapa ${nome}`, e);
      falhas.push({ etapa: nome, erro: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    }
  };
  await etapa('mensagens', async () => {
    for (;;) {
      const { data, error } = await db.from('mensagens').select('id, arquivo_path').lt('criado_em', corte).limit(LOTE);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      const paths = data.map((m) => m.arquivo_path).filter((p): p is string => Boolean(p));
      await midia.remover(paths);
      const { error: e2 } = await db.from('mensagens').delete().in('id', data.map((m) => m.id));
      if (e2) throw new Error(e2.message);
      r.mensagens += data.length;
      r.arquivos += paths.length;
    }
  });
  await etapa('decisoes', async () => {
    const { data, error } = await db.from('decisoes_agente').delete().lt('criado_em', corte).select('id');
    if (error) throw new Error(error.message);
    r.decisoes = data?.length ?? 0;
  });
  await etapa('assistente', async () => {
    const { data, error } = await db.from('assistente_mensagens').delete().lt('criado_em', corte).select('id');
    if (error) throw new Error(error.message);
    r.assistente = data?.length ?? 0;
  });
  // Testes do agente (Treinar o agente) ficam só 30 dias.
  await etapa('simulacoes', async () => {
    const limiteSimulacoes = new Date(agora.getTime() - 30 * 24 * 60 * 60_000).toISOString();
    const { data, error } = await db.from('simulacoes_agente').delete().lt('criado_em', limiteSimulacoes).select('id');
    if (error) throw new Error(error.message);
    r.simulacoes = data?.length ?? 0;
  });
  // Sugestões de resposta (Atendimento) ficam só 1 dia (P11): são rascunhos de quem pediu.
  await etapa('sugestoes', async () => {
    const limiteSugestoes = new Date(agora.getTime() - 24 * 60 * 60_000).toISOString();
    const { data, error } = await db.from('sugestoes_resposta').delete().lt('criado_em', limiteSugestoes).select('id');
    if (error) throw new Error(error.message);
    r.sugestoes = data?.length ?? 0;
  });
  if (falhas.length > 0) throw new ErroLimpeza(r, falhas);
  return r;
}

const contagens = (r: ResultadoLimpeza) => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ');

/**
 * Auditoria 6.5: a limpeza diária registra o resultado em alertas (nível operacional: fica no painel, sem e-mail nem
 * WhatsApp todo dia). Com falha, também um alerta crítico ao dono, uma vez por dia (as novas tentativas do job não repetem),
 * e o erro segue para o job constar como falho.
 */
export async function limparERegistrar(
  d: { db: Db; midia: ArmazenamentoMidia; repos: Pick<Repos, 'registrarAlerta' | 'marcarAvisoUnico' | 'desmarcarAvisoUnico'>; alertas: Pick<Alertas, 'alertar'> },
  agora = new Date(),
): Promise<ResultadoLimpeza> {
  const registrar = (mensagem: string) => d.repos.registrarAlerta({ nivel: 'operacional', mensagem })
    .catch((e) => console.error('[retenção] resultado não registrado', e));
  let r: ResultadoLimpeza;
  try {
    r = await limparRetencao(d.db, d.midia, agora);
  } catch (e) {
    const falhas = e instanceof ErroLimpeza ? e.falhas : [{ etapa: 'mensagens' as const, erro: e instanceof Error ? e.message : String(e) }];
    const parcial = e instanceof ErroLimpeza ? `; apagado: ${contagens(e.parcial)}` : '';
    await registrar(`Limpeza diária com falha em ${falhas.map((f) => `${f.etapa} (${f.erro})`).join('; ')}${parcial}.`);
    const chave = `limpeza-falhou:${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)}`;
    try {
      if (await d.repos.marcarAvisoUnico(chave)) {
        try {
          await d.alertas.alertar({ nivel: 'critico',
            mensagem: `A limpeza diária dos dados antigos falhou (${falhas.map((f) => f.etapa).join(', ')}). Veja os alertas do painel.` });
        } catch (e3) {
          // Revisão: o alerta não saiu; sem a marca, a nova tentativa do job avisa.
          await d.repos.desmarcarAvisoUnico(chave).catch((e4) => console.error('[retenção] marca do alerta não desfeita', e4));
          throw e3;
        }
      }
    } catch (e2) {
      console.error('[retenção] alerta de falha não enviado', e2);
    }
    throw e;
  }
  console.log(`[retenção] limpeza feita: ${contagens(r)}`);
  await registrar(`Limpeza diária feita: ${contagens(r)}.`);
  return r;
}
