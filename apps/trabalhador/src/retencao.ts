import type { Db, Repos } from '@escritorio/db';
import type { Alertas } from './alertas';
import { naVez } from './fila';
import type { ArmazenamentoMidia } from './midia/armazenamento';

const LOTE = 500;
/** Auditoria 6.3: linhas por chamada de retencao_apagar; o trabalhador repete até a volta vir menor que o lote. */
const LOTE_BANCO = 1000;
/** Teto de voltas por regra numa rodada (1 milhão de linhas); o que sobrar sai na limpeza de amanhã. */
const MAX_VOLTAS = 1000;

/** Auditoria 4.17: a limpeza tem trava própria de 2 h; uma segunda limpeza (nova tentativa do pg-boss) sai sem limpar. */
export const TRAVA_LIMPEZA = { chave: 'limpeza-retencao', segundos: 2 * 60 * 60 } as const;

export async function limpezaNaVez<T>(
  repos: Pick<Repos, 'pegarTrava' | 'soltarTrava' | 'renovarTrava'>, limpar: () => Promise<T>,
): Promise<T | 'ocupada'> {
  return naVez(repos, TRAVA_LIMPEZA.chave, TRAVA_LIMPEZA.segundos, limpar,
    async () => { console.log('[retenção] outra limpeza em andamento; esta sai'); });
}

export type ResultadoLimpeza = {
  mensagens: number; arquivos: number; decisoes: number; assistente: number; simulacoes: number; sugestoes: number;
  conversas: number; eventosConversa: number; demandas: number; alertas: number; auditoria: number; foraDoAcesso: number; radar: number;
};

/** Auditoria 6.5: uma ou mais etapas falharam; as outras rodaram e `parcial` tem o que elas apagaram. */
export class ErroLimpeza extends Error {
  constructor(readonly parcial: ResultadoLimpeza, readonly falhas: { etapa: keyof ResultadoLimpeza; erro: string }[]) {
    super(`Limpeza com falha em ${falhas.map((f) => `${f.etapa} (${f.erro})`).join('; ')}`);
  }
}

/** Auditoria 6.3: etapa do resultado → regra de public.retencao_apagar (prazos na migração 20261030001300 e no manual). */
const REGRAS_NO_BANCO: [keyof ResultadoLimpeza, string][] = [
  ['conversas', 'conversas'], ['eventosConversa', 'conversa_eventos'], ['demandas', 'demandas'], ['alertas', 'alertas'],
  ['auditoria', 'auditoria'], ['foraDoAcesso', 'fora_do_acesso'], ['radar', 'radar_envios'],
];

/**
 * Conversas, anexos e decisões do agente e as conversas com o assistente interno ficam guardados por 1 ano (spec, seção 9);
 * os testes do agente (simulacoes_agente), 30 dias; as sugestões de resposta, 1 dia.
 * Auditoria 6.3: também a conversa parada (sem mensagem) e a demanda concluída há mais de 1 ano (com eventos e tarefas),
 * eventos de conversa, alertas, pedidos fora do acesso e envios do Radar com mais de 1 ano; auditoria com mais de 5 anos.
 * Em lotes no banco: a primeira rodada leva um ano de atraso sem segurar as tabelas.
 * Auditoria 6.5: cada etapa no seu try; a falha de uma não trava as outras. Com falha, ErroLimpeza no fim (com as contagens).
 */
export async function limparRetencao(db: Db, midia: ArmazenamentoMidia, agora = new Date()): Promise<ResultadoLimpeza> {
  const limite = new Date(agora);
  limite.setFullYear(limite.getFullYear() - 1);
  const corte = limite.toISOString();
  const r: ResultadoLimpeza = {
    mensagens: 0, arquivos: 0, decisoes: 0, assistente: 0, simulacoes: 0, sugestoes: 0,
    conversas: 0, eventosConversa: 0, demandas: 0, alertas: 0, auditoria: 0, foraDoAcesso: 0, radar: 0,
  };
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
  // Auditoria 6.3: depois das mensagens (a conversa só sai sem nenhuma mensagem, então nenhum anexo fica para trás).
  for (const [nome, regra] of REGRAS_NO_BANCO) {
    await etapa(nome, async () => {
      for (let i = 0; i < MAX_VOLTAS; i++) {
        const { data, error } = await db.rpc('retencao_apagar', { p_regra: regra, p_agora: agora.toISOString(), p_lote: LOTE_BANCO });
        if (error) throw new Error(error.message);
        r[nome] += data ?? 0;
        if ((data ?? 0) < LOTE_BANCO) break;
      }
    });
  }
  if (falhas.length > 0) throw new ErroLimpeza(r, falhas);
  return r;
}

const contagens = (r: ResultadoLimpeza) => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ');

type DepsRegistro = { repos: Pick<Repos, 'registrarAlerta' | 'marcarAvisoUnico' | 'desmarcarAvisoUnico'>; alertas: Pick<Alertas, 'alertar'> };

/** Resultado da rotina em alertas, nível operacional (fica no painel, sem e-mail nem WhatsApp toda vez). */
function registrador(d: DepsRegistro, rotulo: string) {
  return (mensagem: string) => d.repos.registrarAlerta({ nivel: 'operacional', mensagem })
    .catch((e) => console.error(`[${rotulo}] resultado não registrado`, e));
}

/**
 * Auditoria 6.5: falha de rotina vira um alerta crítico ao dono, uma vez por dia (as novas tentativas do job não repetem).
 * Revisão: se o alerta não sair, a marca é desfeita e a nova tentativa do job avisa.
 */
async function alertarFalhaUmaVezPorDia(d: DepsRegistro, rotulo: string, prefixo: string, mensagem: string, agora: Date): Promise<void> {
  const chave = `${prefixo}:${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)}`;
  try {
    if (await d.repos.marcarAvisoUnico(chave)) {
      try {
        await d.alertas.alertar({ nivel: 'critico', mensagem });
      } catch (e3) {
        await d.repos.desmarcarAvisoUnico(chave).catch((e4) => console.error(`[${rotulo}] marca do alerta não desfeita`, e4));
        throw e3;
      }
    }
  } catch (e2) {
    console.error(`[${rotulo}] alerta de falha não enviado`, e2);
  }
}

/**
 * Auditoria 6.5: a limpeza diária registra o resultado em alertas (nível operacional: fica no painel, sem e-mail nem
 * WhatsApp todo dia). Com falha, também um alerta crítico ao dono, uma vez por dia (as novas tentativas do job não repetem),
 * e o erro segue para o job constar como falho.
 */
export async function limparERegistrar(d: DepsRegistro & { db: Db; midia: ArmazenamentoMidia }, agora = new Date()): Promise<ResultadoLimpeza> {
  const registrar = registrador(d, 'retenção');
  let r: ResultadoLimpeza;
  try {
    r = await limparRetencao(d.db, d.midia, agora);
  } catch (e) {
    const falhas = e instanceof ErroLimpeza ? e.falhas : [{ etapa: 'mensagens' as const, erro: e instanceof Error ? e.message : String(e) }];
    const parcial = e instanceof ErroLimpeza ? `; apagado: ${contagens(e.parcial)}` : '';
    await registrar(`Limpeza diária com falha em ${falhas.map((f) => `${f.etapa} (${f.erro})`).join('; ')}${parcial}.`);
    await alertarFalhaUmaVezPorDia(d, 'retenção', 'limpeza-falhou',
      `A limpeza diária dos dados antigos falhou (${falhas.map((f) => f.etapa).join(', ')}). Veja os alertas do painel.`, agora);
    throw e;
  }
  console.log(`[retenção] limpeza feita: ${contagens(r)}`);
  await registrar(`Limpeza diária feita: ${contagens(r)}.`);
  return r;
}

// ---------------------------------------------------------------------------------------------------------------------
// Auditoria 6.4: varredura semanal dos arquivos sem dono.

export const COMPARTIMENTOS = ['anexos', 'documentos', 'tarefas'] as const;
export type Compartimento = (typeof COMPARTIMENTOS)[number];
export type ObjetoStorage = { nome: string; criadoEm: string | null };

/** O que a varredura usa do Storage e do banco (o teste troca listar e remover por um Storage falso). */
export type StorageVarredura = {
  /** Uma página de objetos em ordem de nome, depois de `depois` (null = do começo). Página vazia = acabou. */
  listar(bucket: Compartimento, depois: string | null): Promise<ObjetoStorage[]>;
  /** Dos nomes, os que nenhuma linha aponta (public.caminhos_referenciados). */
  semReferencia(bucket: Compartimento, nomes: string[]): Promise<string[]>;
  remover(bucket: Compartimento, nomes: string[]): Promise<void>;
};

/** Objeto mais novo que isto nunca sai, mesmo sem referência (upload em andamento, linha gravada depois do arquivo). */
export const IDADE_MINIMA_ORFAO_MS = 7 * 24 * 60 * 60_000;
/** Teto de remoções por rodada (com a chave ligada). */
export const LIMITE_ORFAOS_POR_RODADA = 500;
const AMOSTRA = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIXOS = new Set(['conversas', 'clientes', 'drive']);

/**
 * O caminho no alerta sem nada que identifique alguém: o nome do arquivo pode ter nome de pessoa. Ficam o compartimento,
 * os prefixos conhecidos, os códigos (UUID) e o começo numérico do nome (a hora do envio); o resto vira "…".
 */
export function caminhoParaAlerta(bucket: string, nome: string): string {
  const partes = nome.split('/');
  return `${bucket}:${partes.map((p, i) => {
    if (UUID.test(p) || (PREFIXOS.has(p) && i < partes.length - 1)) return p;
    return `${/^\d+/.exec(p)?.[0] ?? ''}…`;
  }).join('/')}`;
}

export function criarStorageVarredura(db: Db): StorageVarredura {
  return {
    async listar(bucket, depois) {
      const { data, error } = await db.rpc('listar_objetos_storage', { p_bucket: bucket, ...(depois ? { p_depois: depois } : {}), p_limite: 1000 });
      if (error) throw new Error(error.message);
      return (data ?? []).map((o) => ({ nome: o.nome, criadoEm: o.criado_em }));
    },
    async semReferencia(bucket, nomes) {
      if (nomes.length === 0) return [];
      const { data, error } = await db.rpc('caminhos_sem_referencia', { p_bucket: bucket, p_nomes: nomes });
      if (error) throw new Error(error.message);
      return (data ?? []) as string[];
    },
    async remover(bucket, nomes) {
      if (nomes.length === 0) return;
      const { error } = await db.storage.from(bucket).remove(nomes);
      if (error) throw new Error(`remoção falhou: ${error.message}`);
    },
  };
}

export type ResultadoVarredura = { apagar: boolean; candidatos: Record<Compartimento, number>; apagados: number; amostra: string[] };

/**
 * Lista os três compartimentos página a página e separa os objetos com 7 dias ou mais que nenhuma linha aponta.
 * Com `apagar` falso (padrão do dono) só conta e guarda uma amostra; ligado, apaga até `limite` por rodada, conferindo a
 * referência de novo logo antes de apagar.
 */
export async function varrerOrfaos(
  storage: StorageVarredura, opcoes: { apagar: boolean; agora?: Date; limite?: number },
): Promise<ResultadoVarredura> {
  const agora = (opcoes.agora ?? new Date()).getTime();
  const limite = opcoes.limite ?? LIMITE_ORFAOS_POR_RODADA;
  const r: ResultadoVarredura = { apagar: opcoes.apagar, candidatos: { anexos: 0, documentos: 0, tarefas: 0 }, apagados: 0, amostra: [] };
  for (const bucket of COMPARTIMENTOS) {
    let depois: string | null = null;
    for (;;) {
      const pagina = await storage.listar(bucket, depois);
      if (pagina.length === 0) break;
      depois = pagina[pagina.length - 1]!.nome;
      const velhos = pagina.filter((o) => o.criadoEm !== null && agora - Date.parse(o.criadoEm) >= IDADE_MINIMA_ORFAO_MS).map((o) => o.nome);
      const orfaos = await storage.semReferencia(bucket, velhos);
      r.candidatos[bucket] += orfaos.length;
      for (const n of orfaos) if (r.amostra.length < AMOSTRA) r.amostra.push(caminhoParaAlerta(bucket, n));
      if (opcoes.apagar && r.apagados < limite && orfaos.length > 0) {
        const confirmados = await storage.semReferencia(bucket, orfaos.slice(0, limite - r.apagados));
        await storage.remover(bucket, confirmados);
        r.apagados += confirmados.length;
      }
    }
  }
  return r;
}

/** Auditoria 6.4: a varredura tem trava própria (a mesma ideia da limpeza diária). */
export const TRAVA_VARREDURA = { chave: 'varredura-orfaos', segundos: 2 * 60 * 60 } as const;

/**
 * A varredura semanal: lê a chave das Configurações (varredura_orfaos_apagar, padrão falso = só relatório), roda e
 * registra o total e a amostra em alertas (operacional). Falha: alerta operacional, um crítico por dia e o erro segue.
 */
export async function varrerERegistrar(
  d: DepsRegistro & { db: Db; storage: StorageVarredura }, agora = new Date(),
): Promise<ResultadoVarredura> {
  const registrar = registrador(d, 'varredura');
  let r: ResultadoVarredura;
  try {
    const { data, error } = await d.db.from('configuracoes').select('varredura_orfaos_apagar').eq('id', 1).single();
    if (error) throw new Error(error.message);
    r = await varrerOrfaos(d.storage, { apagar: data.varredura_orfaos_apagar, agora });
  } catch (e) {
    const erro = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    await registrar(`Varredura semanal de arquivos sem dono com falha (${erro}).`);
    await alertarFalhaUmaVezPorDia(d, 'varredura', 'varredura-falhou',
      'A varredura semanal dos arquivos sem dono falhou. Veja os alertas do painel.', agora);
    throw e;
  }
  const total = COMPARTIMENTOS.map((b) => `${b} ${r.candidatos[b]}`).join(', ');
  const exemplos = r.amostra.length > 0 ? ` Exemplos: ${r.amostra.join(', ')}.` : '';
  const mensagem = r.apagar
    ? `Varredura semanal de arquivos sem dono: ${total}. Apagados ${r.apagados} (até ${LIMITE_ORFAOS_POR_RODADA} por semana).${exemplos}`
    : `Varredura semanal de arquivos sem dono (só relatório, nada foi apagado): ${total}.${exemplos}`;
  console.log(`[varredura] ${total}; apagados ${r.apagados}`);
  await registrar(mensagem);
  return r;
}
