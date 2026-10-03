import type Anthropic from '@anthropic-ai/sdk';
import type { FuncionalidadeGravavel } from '@escritorio/core';
import type { Repos, SugestaoResposta } from '@escritorio/db';
import type { CanalWhatsApp } from '../canal/tipos';
import { FERRAMENTAS_ASSISTENTE, executarConsultaAssistente, falha, objeto, ok, type DepsAssistente, type EstadoAssistente, type Resultado } from '../assistente/ferramentas';

/** As únicas ferramentas do assistente que a sugestão usa: todas só leem (spec 7A.1, decisão 7). */
export const LEITURAS_SUGESTAO = [
  'listar_demandas', 'ver_demanda', 'buscar_empresas', 'buscar_parceiros', 'buscar_produtos', 'consultar_preco', 'dados_cadastro', 'resumo_vendas',
] as const;

/** Pseudo-ferramenta: só guarda o rascunho na memória. Não envia nada. */
export const ENTREGAR_RASCUNHO: Anthropic.Tool = {
  name: 'entregar_rascunho',
  description: 'Entrega o rascunho da resposta ao cliente para a pessoa da equipe revisar. Nada é enviado ao cliente.',
  input_schema: objeto({ texto: { type: 'string', description: 'O rascunho, como a equipe escreveria no WhatsApp.' } }, ['texto']),
};

export const FERRAMENTAS_SUGESTAO: Anthropic.Tool[] = [
  ...FERRAMENTAS_ASSISTENTE.filter((f) => (LEITURAS_SUGESTAO as readonly string[]).includes(f.name)),
  ENTREGAR_RASCUNHO,
];

/** Métodos do repositório liberados na sugestão: só leituras. Qualquer outro lança erro (nada grava por engano). */
export const LEITURAS_REPOS_SUGESTAO = [
  'obterConfiguracoes', 'custoIaDoMes', 'setoresAtivos', 'obterConversa', 'buscarContato', 'historico', 'chamadosAbertosDaConversa',
  'chamadosDaConversaParaVisibilidade', 'usuarioDoAssistente', 'obterUsuarioAssistente', 'horarioPermite', 'chamadosRecentes', 'chamadoPorNumero',
  'eventosDoChamado', 'buscarEmpresas', 'unidadesDaEmpresa', 'produtosDaEmpresa', 'precosVigentes', 'dadosDaEmpresa', 'pedidosVendaParaBling',
  'nomesDasRedes', 'servicosDoCliente', 'documentosDaEmpresa', 'respostasProntas', 'chamadosAbertosDoCliente',
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

export type EstadoSugestao = EstadoAssistente & { rascunho: string | null };

/** Só as leituras da lista e a entrega do rascunho; o resto volta erro para a IA, sem executar nada. */
export async function executarLeituraSugestao(d: DepsAssistente, estado: EstadoSugestao | EstadoAssistente, nome: string, entrada: unknown): Promise<Resultado> {
  if (nome === ENTREGAR_RASCUNHO.name) {
    const texto = typeof (entrada as { texto?: unknown } | null)?.texto === 'string' ? (entrada as { texto: string }).texto.trim() : '';
    if (!texto) return falha('Rascunho vazio: escreva o texto da resposta.');
    if (texto.length > 4000) return falha('Rascunho longo demais: até 4000 caracteres.');
    (estado as EstadoSugestao).rascunho = texto;
    return ok({ entregue: true });
  }
  if (!(LEITURAS_SUGESTAO as readonly string[]).includes(nome)) return falha(`A ferramenta ${nome} não está disponível na sugestão: aqui só se consulta.`);
  return executarConsultaAssistente(d, estado, nome, entrada);
}
