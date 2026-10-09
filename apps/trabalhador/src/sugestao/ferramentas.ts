import type Anthropic from '@anthropic-ai/sdk';
import type { AcessoContato, FuncionalidadeGravavel } from '@escritorio/core';
import type { Repos, SugestaoResposta } from '@escritorio/db';
import { ACESSO_BASICO, ehBasico, podeFluxoNota, tituloSemValores } from '../agente/acesso';
import { diaMes } from '../agente/ferramentas';
import type { ContextoAssistente } from '../assistente/contexto';
import type { CanalWhatsApp } from '../canal/tipos';
import { FERRAMENTAS_ASSISTENTE, executarConsultaAssistente, falha, objeto, ok, type DepsAssistente, type EstadoAssistente, type Resultado } from '../assistente/ferramentas';

/**
 * As únicas ferramentas do assistente que a sugestão usa: todas só leem (spec 7A.1, decisão 7).
 * Auditoria 5.10: buscar_empresas, resumo_vendas e listar_demandas saíram (alcançavam outras empresas); as que ficam
 * valem só para a empresa desta conversa e para as demandas dela (escopoDaSugestao).
 */
export const LEITURAS_SUGESTAO = [
  'ver_demanda', 'buscar_parceiros', 'buscar_produtos', 'consultar_preco', 'dados_cadastro',
] as const;

/** Pseudo-ferramenta: só guarda o rascunho na memória. Não envia nada. */
export const ENTREGAR_RASCUNHO: Anthropic.Tool = {
  name: 'entregar_rascunho',
  description: 'Entrega o rascunho da resposta ao cliente para a pessoa da equipe revisar. Nada é enviado ao cliente.',
  input_schema: objeto({ texto: { type: 'string', description: 'O rascunho, como a equipe escreveria no WhatsApp.' } }, ['texto']),
};

/** Revisão da Task 16 (auditoria 5.10): só da sugestão, espelha o consultar_chamados do agente (o que o contato acompanha). */
export const DEMANDAS_DO_CONTATO: Anthropic.Tool = {
  name: 'demandas_do_contato',
  description: 'Demandas que o contato desta conversa acompanha na empresa desta conversa (número, título, status, setor e quando abriu). '
    + 'Use para contar o andamento; os detalhes de uma delas, com ver_demanda.',
  input_schema: objeto({}, []),
};

const CLIENTE_ID = ' cliente_id = id da empresa desta conversa (o do "Atendimento" acima); outra empresa é recusada.';
/** Descrições da sugestão: sem buscar_empresas (fora da sugestão) e com a empresa fixa (revisão da Task 16). */
const DESCRICOES_SUGESTAO: Record<string, string> = {
  ver_demanda: 'Detalhes de uma demanda que o contato desta conversa acompanha (as de demandas_do_contato), pelo número.',
  buscar_parceiros: `Procura, nos cadastros da empresa desta conversa, os clientes (tipo "cliente") ou fornecedores dela.${CLIENTE_ID}`,
  buscar_produtos: `Procura produtos cadastrados da empresa desta conversa pelo nome, apelido ou código.${CLIENTE_ID}`,
  consultar_preco: `Preço de tabela de um produto para a rede de uma unidade de cliente da empresa desta conversa.${CLIENTE_ID}`,
  dados_cadastro: `Dados cadastrais da empresa desta conversa ou, com unidade_id, de um cliente/fornecedor dela.${CLIENTE_ID}`,
};

export const FERRAMENTAS_SUGESTAO: Anthropic.Tool[] = [
  ...FERRAMENTAS_ASSISTENTE.filter((f) => (LEITURAS_SUGESTAO as readonly string[]).includes(f.name))
    .map((f) => ({ ...f, description: DESCRICOES_SUGESTAO[f.name] ?? f.description })),
  DEMANDAS_DO_CONTATO,
  ENTREGAR_RASCUNHO,
];

/** Métodos do repositório liberados na sugestão: só leituras. Qualquer outro lança erro (nada grava por engano). */
export const LEITURAS_REPOS_SUGESTAO = [
  'obterConfiguracoes', 'custoIaDoMes', 'setoresAtivos', 'obterConversa', 'buscarContato', 'historico', 'chamadosAbertosDaConversa',
  'chamadosDaConversaParaVisibilidade', 'usuarioDoAssistente', 'obterUsuarioAssistente', 'horarioPermite', 'chamadosRecentes', 'chamadoPorNumero',
  'eventosDoChamado', 'buscarEmpresas', 'unidadesDaEmpresa', 'produtosDaEmpresa', 'precosVigentes', 'dadosDaEmpresa', 'pedidosVendaParaBling',
  'nomesDasRedes', 'servicosDoCliente', 'documentosDaEmpresa', 'respostasProntas', 'chamadosAbertosDoCliente', 'acessoDoContato',
  'demandasParaContato',
] as const satisfies readonly (keyof Repos)[];

export class BloqueadoNaSugestao extends Error {
  constructor(o: string) {
    super(`A sugestão não grava nem envia nada (${o}).`);
    this.name = 'BloqueadoNaSugestao';
  }
}

/** WhatsApp da sugestão: qualquer envio lança erro (como no Treinar o agente); nada sai para o cliente. */
export function canalDaSugestao(): CanalWhatsApp {
  return {
    interpretarWebhook: () => null,
    enviarTexto: async () => { throw new BloqueadoNaSugestao('WhatsApp'); },
    enviarArquivo: async () => { throw new BloqueadoNaSugestao('WhatsApp'); },
    status: async () => { throw new BloqueadoNaSugestao('WhatsApp'); },
  };
}

const FUNCIONALIDADE: FuncionalidadeGravavel = 'sugerir_resposta';

/** Repositório da sugestão: só leituras; o custo vai com a funcionalidade, a pessoa e a conversa (spec 3.1). */
export function reposDaSugestao(repos: Repos, s: Pick<SugestaoResposta, 'usuario_id' | 'conversa_id'>): Repos {
  const liberados: Record<string, unknown> = {};
  for (const nome of LEITURAS_REPOS_SUGESTAO) liberados[nome] = (repos[nome] as (...a: unknown[]) => unknown).bind(repos);
  liberados.registrarUsoIa = (u: Parameters<Repos['registrarUsoIa']>[0]) =>
    repos.registrarUsoIa({ ...u, conversaId: s.conversa_id, funcionalidade: FUNCIONALIDADE, usuarioId: s.usuario_id });
  return new Proxy(liberados, {
    get(alvo, nome) {
      if (typeof nome !== 'string' || nome === 'then') return undefined;
      if (Object.hasOwn(alvo, nome)) return alvo[nome];
      return () => { throw new BloqueadoNaSugestao(`repositório: ${nome}`); };
    },
  }) as unknown as Repos;
}

/**
 * Auditoria 5.10: o mesmo recorte do agente para esta conversa. A empresa é a do contexto (empresaDoUso, como o agente:
 * várias sem foco = nenhuma) e o acesso é o do contato nela (acessoDoContato; sem contato ou sem leitura, Básico).
 */
export type EscopoSugestao = {
  conversaId: string | null; clienteId: string | null; contatoId: string | null; acesso: AcessoContato; fiscalId: string | null;
};

export async function escopoDaSugestao(repos: Repos, ctx: ContextoAssistente): Promise<EscopoSugestao> {
  const clienteId = ctx.conversa?.empresa?.id ?? null;
  const contatoId = ctx.conversa?.contatoId ?? null;
  let acesso = ACESSO_BASICO;
  if (clienteId && contatoId) {
    try {
      acesso = (await repos.acessoDoContato(contatoId, clienteId)) ?? ACESSO_BASICO;
    } catch (erro) {
      // Como no agente: sem conseguir ler o acesso, Básico (nunca acesso total).
      console.error('[sugestão] acesso não lido; tratado como Básico', contatoId, clienteId, erro);
    }
  }
  return { conversaId: ctx.conversaId, clienteId, contatoId, acesso, fiscalId: ctx.setores.find((s) => s.nome === 'Fiscal')?.id ?? null };
}

export type EstadoSugestao = EstadoAssistente & { rascunho: string | null; escopo: EscopoSugestao };

const FORA_DA_EMPRESA = 'Na sugestão só se consultam dados da empresa desta conversa, nunca de outra empresa. Escreva que a equipe vai verificar.';
const SEM_EMPRESA = 'Esta conversa não tem empresa definida: não consulte dados de empresa. Escreva que a equipe vai verificar.';
const DEMANDA_DE_FORA = 'Na sugestão só se consultam as demandas que o contato desta conversa acompanha (demandas_do_contato).';

/** O mesmo conjunto do consultar_chamados do agente: Básico, sem contato ou sem empresa = nenhuma. */
async function demandasDoContato(d: DepsAssistente, e: EscopoSugestao) {
  if (!e.clienteId || !e.contatoId || !e.conversaId || ehBasico(e.acesso)) return [];
  return d.repos.demandasParaContato(e.contatoId, e.clienteId, e.conversaId);
}
const SEM_ACESSO_DADOS = 'Este contato ainda não recebe dados pelo WhatsApp (acesso Básico): não traga cadastro, preço nem produto no rascunho; diga que a equipe vai verificar.';
const SEM_ACESSO_NOTA = 'Este contato não pede nota nem consulta preços e cadastros de clientes e fornecedores: não traga esses dados no rascunho; diga que a equipe vai verificar.';

/** Confere a empresa e o acesso antes da consulta; null = pode seguir. */
async function foraDoEscopo(d: DepsAssistente, e: EscopoSugestao, nome: string, entrada: unknown): Promise<Resultado | null> {
  const x = (entrada ?? {}) as { cliente_id?: unknown; unidade_id?: unknown; numero?: unknown };
  if (nome === 'ver_demanda') {
    // Revisão da Task 16: sem conversa, recusa (fecha por padrão); entrada inválida, a validação de sempre responde.
    if (!e.conversaId) return falha(DEMANDA_DE_FORA);
    if (typeof x.numero !== 'number') return null;
    const permitidas = new Set((await demandasDoContato(d, e)).map((c) => Number(c.numero)));
    return permitidas.has(x.numero) ? null : falha(DEMANDA_DE_FORA);
  }
  if (!e.clienteId) return falha(SEM_EMPRESA);
  if (x.cliente_id !== e.clienteId) return falha(FORA_DA_EMPRESA);
  if (ehBasico(e.acesso)) return falha(SEM_ACESSO_DADOS);
  // O cadastro da própria empresa vale para todo contato que não é Básico; o resto é do fluxo de nota (como no agente).
  if (nome === 'dados_cadastro' && x.unidade_id === undefined) return null;
  return podeFluxoNota(e.acesso, e.fiscalId) ? null : falha(SEM_ACESSO_NOTA);
}

/** Só as leituras da lista e a entrega do rascunho; o resto volta erro para a IA, sem executar nada. */
export async function executarLeituraSugestao(d: DepsAssistente, estado: EstadoSugestao, nome: string, entrada: unknown): Promise<Resultado> {
  if (nome === ENTREGAR_RASCUNHO.name) {
    const texto = typeof (entrada as { texto?: unknown } | null)?.texto === 'string' ? (entrada as { texto: string }).texto.trim() : '';
    if (!texto) return falha('Rascunho vazio: escreva o texto da resposta.');
    if (texto.length > 4000) return falha('Rascunho longo demais: até 4000 caracteres.');
    estado.rascunho = texto;
    return ok({ entregue: true });
  }
  if (nome === DEMANDAS_DO_CONTATO.name) {
    try {
      // Sem "Ver valores", o valor em reais escrito no título não sai (como no agente).
      const titulo = (t: string) => (estado.escopo.acesso.verValores ? t : tituloSemValores(t));
      return ok({ demandas: (await demandasDoContato(d, estado.escopo)).map((c) => ({
        numero: c.numero, titulo: titulo(c.titulo), status: c.status, setor: c.setor_nome ?? 'Triagem', aberta_em: diaMes(c.criado_em),
      })) });
    } catch (e) {
      console.error('[sugestão] demandas do contato', e);
      return falha('Não consegui consultar agora; tente de novo.');
    }
  }
  if (!(LEITURAS_SUGESTAO as readonly string[]).includes(nome)) return falha(`A ferramenta ${nome} não está disponível na sugestão: aqui só se consulta.`);
  try {
    const recusa = await foraDoEscopo(d, estado.escopo, nome, entrada);
    if (recusa) return recusa;
  } catch (e) {
    console.error('[sugestão] conferência do escopo', nome, e);
    return falha('Não consegui consultar agora; tente de novo.');
  }
  return executarConsultaAssistente(d, estado, nome, entrada);
}
