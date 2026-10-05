import { SLUG_ATENDIMENTO, estaNoExpediente, mesReferencia } from '@escritorio/core';
import type { Conversa, EmpresaDoContato, Mensagem, OrientacaoAgente, RascunhoOrientacao, Repos, SimulacaoAgente, UsuarioAssistente } from '@escritorio/db';
import { podeVerChamado } from '../assistente/visibilidade';
import type { CanalWhatsApp } from '../canal/tipos';
import { LimitadorEnvio } from '../envio';
import type { ArmazenamentoMidia } from '../midia/armazenamento';
import { acessoTotal } from './acesso';
import { erroTemporarioIa, type ClienteIa } from './cliente-ia';
import type { ContextoAgente } from './contexto';
import { executarAgente, type ResultadoAgente } from './executar';
import {
  AVISOS, PedidoNota, avisoForaDoHorario, empresaDefinida, executarFerramenta, exigirEmpresa, falha, ok, partesDaResposta,
  prepararPedido, validarEntrada, type DepsAgente, type EstadoExecucao, type ExecutorFerramentas, type NomeFerramenta, type Resultado,
} from './ferramentas';
import { orientacoesDaConversa } from './orientacoes';
import { acharResumoConferido, chaveConferencia, formatarReais, montarPedidoNota, montarResumoParaCliente } from './pedido-nota';
import { carregarPerfil } from './perfil';
import { montarConteudoUsuario } from './prompt';

/**
 * Simulação do agente de clientes (Treinar o agente, spec §4): roda o agente de verdade sobre uma conversa fictícia, com as
 * orientações ligadas + o rascunho, e um executor de ferramentas que só lê. Nada é gravado nas tabelas de negócio e nada vai
 * para o WhatsApp: o que o agente mandaria e o que ele tentaria fazer ficam em `simulacoes_agente.respostas`.
 * Só o custo da IA é gravado (`uso_ia`, sem conversa), porque conta no teto do mês.
 */

/** O que a simulação grava em `respostas` (o painel lê este formato). */
export type RespostasSimulacao = {
  /** Textos que o cliente receberia, na ordem (cada parágrafo de `responder` é uma mensagem; resumos de nota inteiros). */
  mensagens: string[];
  /** Ações que o agente tentaria, em português (ex.: "Abriria uma demanda no Fiscal: Guia DAS"). */
  acoes: { ferramenta: string; resumo: string }[];
  /** Avisos sobre o teste em si (orientação em teste fora do alcance, orientações cortadas pelo limite). */
  observacoes: string[];
};

export const MENSAGEM_TETO_SIMULACAO = 'O limite mensal de gasto com IA foi atingido. O teste não pode ser feito agora; fale com o administrador.';
export const MENSAGEM_FALHA_SIMULACAO = 'Não consegui fazer o teste agora. Tente de novo em alguns minutos.';
export const MENSAGEM_PRAZO_SIMULACAO = 'O teste demorou demais e foi interrompido. Tente de novo com uma mensagem mais curta.';
export const MENSAGEM_EMPRESA_SIMULACAO = 'A empresa escolhida para o teste não foi encontrada ou está inativa. Escolha outra empresa e teste de novo.';
/**
 * Prazo total do teste, contado de quando ele foi pedido (`criado_em`), somando as novas tentativas da fila: fica abaixo dos
 * 5 minutos em que `criar_simulacao` considera um teste pendente abandonado.
 */
export const PRAZO_SIMULACAO_MS = 4 * 60_000;

const TELEFONE_FICTICIO = '5500000000000';
const NOME_FICTICIO = 'Contato de teste';

/** Ferramentas que só leem: rodam de verdade, sempre dentro da empresa em foco (as mesmas travas do atendimento). */
const LEITURAS = new Set<NomeFerramenta>(['buscar_parceiros', 'buscar_produtos', 'consultar_cadastro', 'consultar_preco', 'consultar_chamados', 'listar_documentos', 'ler_skill', 'ler_referencia']);

/** Leituras do banco liberadas na simulação. Qualquer outro método do repositório falha (nada grava por engano). */
const LEITURAS_REPOS = [
  'obterConfiguracoes', 'custoIaDoMes', 'setoresAtivos', 'respostasProntas', 'orientacoesAtivas', 'servicosDoCliente',
  'unidadesDaEmpresa', 'produtosDaEmpresa', 'precosVigentes', 'documentosDaEmpresa', 'dadosDaEmpresa', 'setorPorNome', 'responsaveisDoCliente',
  'perfilDoAgente', 'referenciaDaSkill',
] as const satisfies readonly (keyof Repos)[];

class BloqueadoNaSimulacao extends Error {
  constructor(o: string) {
    super(`A simulação não grava nem envia nada (${o}).`);
  }
}
class PrazoEsgotado extends Error {}

/**
 * Repositório da simulação: só as leituras liberadas; o uso da IA é gravado sem conversa; decisões não são gravadas;
 * a conversa fictícia vem da memória. Qualquer outro método lança erro em vez de gravar.
 * Chamados da empresa: só os que a pessoa que pediu o teste vê no painel (admin: todos; os demais: setores dela e os que
 * ela é responsável), para o teste não mostrar chamados que ela não pode ler.
 */
export function reposDaSimulacao(repos: Repos, conversa: Conversa, usuario: UsuarioAssistente | null, usuarioId: string): Repos {
  const liberados: Record<string, unknown> = {};
  for (const nome of LEITURAS_REPOS) liberados[nome] = (repos[nome] as (...a: unknown[]) => unknown).bind(repos);
  Object.assign(liberados, {
    // Treino, não gasto do cliente (P7): quem pediu o teste, sem conversa e sem empresa.
    registrarUsoIa: (u: Parameters<Repos['registrarUsoIa']>[0]) =>
      repos.registrarUsoIa({ ...u, funcionalidade: 'testar_agente', usuarioId, conversaId: null, clienteId: null }),
    registrarDecisao: async () => {},
    ultimasOrientacoesCortadas: async () => null,
    obterConversa: async () => conversa,
    chamadosAbertosDoCliente: async (clienteId: string) =>
      (await repos.chamadosAbertosDoCliente(clienteId)).filter((c) => usuario?.ativo === true && podeVerChamado(usuario, c)),
  });
  return new Proxy(liberados, {
    get(alvo, nome) {
      if (typeof nome !== 'string' || nome === 'then') return undefined;
      if (Object.hasOwn(alvo, nome)) return alvo[nome];
      return () => { throw new BloqueadoNaSimulacao(`repositório: ${nome}`); };
    },
  }) as unknown as Repos;
}

function canalBloqueado(): CanalWhatsApp {
  return {
    interpretarWebhook: () => null,
    enviarTexto: async () => { throw new BloqueadoNaSimulacao('WhatsApp'); },
    enviarArquivo: async () => { throw new BloqueadoNaSimulacao('WhatsApp'); },
    status: async () => ({ conectado: false }),
  };
}

function midiaBloqueada(): ArmazenamentoMidia {
  return new Proxy({}, { get: (_a, nome) => (nome === 'then' ? undefined : () => { throw new BloqueadoNaSimulacao('arquivos'); }) }) as ArmazenamentoMidia;
}

/**
 * A IA com um prazo total: cada chamada só começa enquanto houver tempo, e a que estiver em andamento no fim do prazo é
 * cancelada (AbortSignal), para a resposta não chegar depois sem entrar em `uso_ia`.
 */
function iaComPrazo(ia: ClienteIa, prazoEm: number): ClienteIa {
  return {
    async criar(p) {
      const resta = prazoEm - Date.now();
      if (resta <= 0) throw new PrazoEsgotado();
      const cancelar = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          ia.criar(p, { signal: cancelar.signal }),
          new Promise<never>((_, rejeitar) => {
            timer = setTimeout(() => { cancelar.abort(); rejeitar(new PrazoEsgotado()); }, resta);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Orientações do teste: as ligadas + o rascunho (como se estivesse ligado). Com `id`, o rascunho entra no lugar da salva. */
export function orientacoesDoTeste(ativas: OrientacaoAgente[], rascunho: RascunhoOrientacao | null, setores: { id: string; nome: string }[], agora: Date): OrientacaoAgente[] {
  if (!rascunho) return ativas;
  const doRascunho: OrientacaoAgente = {
    id: rascunho.id ?? 'rascunho', titulo: rascunho.titulo, texto: rascunho.texto, tipo: rascunho.tipo,
    clienteId: rascunho.cliente_id, setorId: rascunho.setor_id,
    setorNome: rascunho.setor_id ? setores.find((s) => s.id === rascunho.setor_id)?.nome ?? null : null,
    // Mais recente de todas: tem prioridade no limite de caracteres.
    atualizadoEm: agora,
  };
  return [doRascunho, ...ativas.filter((o) => o.id !== rascunho.id)];
}

type Registro = RespostasSimulacao & {
  resumos: { entrada: unknown; conferencia: string }[];
  demandas: number;
  triagemAberta: boolean;
  naoEntendido: number;
};

const acao = (r: Registro, ferramenta: string, resumo: string) => r.acoes.push({ ferramenta, resumo });

/** Ferramentas que gravam ou enviam, na simulação: conferem a entrada como no atendimento, registram e devolvem sucesso fictício. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function simularGravacao(d: DepsAgente, estado: EstadoExecucao, nome: NomeFerramenta, entrada: any, r: Registro): Promise<Resultado> {
  const { ctx } = estado;
  switch (nome) {
    case 'responder': {
      const partes = partesDaResposta(entrada.texto);
      if (partes.length === 0) return falha(AVISOS.textoVazio);
      r.mensagens.push(...partes);
      estado.respondeu = true;
      return ok({ enviado: true, mensagens: partes.length });
    }

    case 'selecionar_empresa': {
      const empresa = ctx.contato?.empresas.find((e) => e.id === entrada.cliente_id);
      if (!empresa) return falha(AVISOS.empresaAlheia);
      ctx.empresaEmFoco = empresa;
      ctx.servicosContratados = await d.repos.servicosDoCliente(empresa.id);
      acao(r, nome, `Registraria que o contato fala pela empresa ${empresa.nome}`);
      return ok({ empresa: empresa.nome, servicos_contratados: ctx.servicosContratados });
    }

    case 'abrir_chamado': {
      const desconhecido = !ctx.contato || ctx.contato.empresas.length === 0;
      if (!desconhecido) {
        const bloqueio = empresaDefinida(estado);
        if (bloqueio) return bloqueio;
      }
      let setorNome = 'Triagem';
      if (!desconhecido && entrada.setor_id !== 'triagem') {
        const setor = ctx.setores.find((s) => s.id === entrada.setor_id);
        if (!setor) return falha(AVISOS.setorInvalido);
        setorNome = setor.nome;
      }
      const fora = entrada.fora_do_contrato ? ' (fora do contrato)' : '';
      if (setorNome === 'Triagem' && r.triagemAberta) {
        acao(r, nome, `Acrescentaria as informações à demanda da Triagem: ${entrada.resumo}`);
      } else {
        if (setorNome === 'Triagem') r.triagemAberta = true;
        r.demandas++;
        acao(r, nome, `Abriria uma demanda ${setorNome === 'Triagem' ? 'na Triagem' : `no ${setorNome}`}${fora}: ${entrada.titulo}`);
      }
      return ok({ numero: r.demandas, setor: setorNome, fora_do_horario: !ctx.noExpediente, aviso_para_o_cliente: avisoForaDoHorario(ctx) });
    }

    case 'sinalizar_nao_entendido': {
      r.naoEntendido++;
      if (r.naoEntendido >= 2) {
        r.demandas++;
        acao(r, nome, 'Não entenderia pela segunda vez e passaria o atendimento para a equipe (demanda na Triagem)');
        return ok({ instrucao: AVISOS.instrucaoEquipeContinua });
      }
      acao(r, nome, 'Não entenderia a mensagem e pediria para o cliente explicar de outra forma');
      return ok({ instrucao: AVISOS.instrucaoExplicarDeNovo });
    }

    case 'resumir_pedido_nota': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      const p = await prepararPedido(d, e.clienteId, entrada);
      if ('erro' in p) return p;
      // O cliente veria o resumo inteiro, montado pelo sistema: entra como mensagem.
      r.mensagens.push(montarResumoParaCliente({ tipo: entrada.tipo, destino: p.destino, textoDestinatario: entrada.texto_destinatario, itens: p.itens, extras: entrada }));
      const conferencia = chaveConferencia(entrada);
      r.resumos.push({ entrada, conferencia });
      estado.respondeu = true;
      acao(r, nome, `Mandaria o resumo de uma nota de ${entrada.tipo === 'venda' ? 'venda' : 'devolução'} para o cliente conferir`);
      return ok({ enviado: true, conferencia, instrucao: AVISOS.instrucaoResumo });
    }

    case 'abrir_pedido_nota': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      if (!entrada.cliente_confirmou_resumo) return falha(AVISOS.pedidoSemConfirmacao);
      // Mesma trava do atendimento: só passa um pedido cujo resumo foi mandado (aqui, neste mesmo teste).
      const achado = acharResumoConferido(entrada, r.resumos, (x): x is typeof entrada => PedidoNota.safeParse(x).success);
      if (achado === null) return falha(AVISOS.pedidoNaoConferido);
      if ('ambiguo' in achado) return falha(AVISOS.pedidoAmbiguo);
      const conferido = { ...PedidoNota.parse(achado.resumo.entrada), pedido_original: entrada.pedido_original };
      const p = await prepararPedido(d, e.clienteId, conferido);
      if ('erro' in p) return p;
      const { titulo } = montarPedidoNota({
        tipo: conferido.tipo, destino: p.destino, textoDestinatario: conferido.texto_destinatario, itens: p.itens,
        pedidoOriginal: conferido.pedido_original, semPermissao: !ctx.empresaEmFoco!.podePedirNota,
      });
      const setorId = await d.repos.setorPorNome('Fiscal');
      r.demandas++;
      acao(r, nome, `Passaria a nota para ${setorId ? 'o Fiscal' : 'a Triagem'}: ${titulo}`);
      return ok({
        numero: r.demandas, setor: setorId ? 'Fiscal' : 'Triagem', itens_sem_cadastro: p.itens.filter((i) => !i.produto).length,
        sem_preco: conferido.tipo === 'venda' ? p.itens.filter((i) => i.produto && i.preco === null).length : 0,
        fora_do_horario: !ctx.noExpediente, aviso_para_o_cliente: avisoForaDoHorario(ctx),
      });
    }

    case 'enviar_documento': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      const doc = (await d.repos.documentosDaEmpresa(e.clienteId)).find((x) => x.id === entrada.documento_id);
      if (!doc) return falha(AVISOS.documentoNaoEncontrado);
      if (!doc.iaPodeEnviar) return falha(AVISOS.documentoNaoLiberado);
      r.mensagens.push(`[documento] ${doc.nome}`);
      estado.respondeu = true;
      acao(r, nome, `Enviaria o documento ${doc.nome}`);
      return ok({ enviado: true, documento: doc.nome });
    }

    case 'alterar_preco': {
      // A consulta de verdade confere a unidade e o produto (só da empresa em foco) e traz o preço atual.
      const consulta = await executarFerramenta(d, estado, 'consultar_preco', { unidade_id: entrada.unidade_id, produto_id: entrada.produto_id });
      if (consulta.erro) return consulta;
      if (!entrada.confirmado_pelo_cliente) return falha(AVISOS.precoSemConfirmacao);
      const atual = JSON.parse(consulta.resultado) as { rede: string; produto: string; unidade: string; preco: string | null };
      const depois = formatarReais(entrada.novo_valor);
      acao(r, nome, `Alteraria o preço de ${atual.produto} para a rede ${atual.rede}: de ${atual.preco ?? 'sem preço'} para ${depois}`);
      return ok({ rede: atual.rede, produto: atual.produto, unidade: atual.unidade, antes: atual.preco, depois });
    }

    case 'cadastrar_produto': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      if (!entrada.confirmado_pelo_cliente) return falha(AVISOS.produtoSemConfirmacao);
      const unidade = entrada.unidade.toUpperCase() || 'UN';
      acao(r, nome, `Cadastraria o produto ${entrada.codigo} - ${entrada.descricao} (${unidade})`);
      return ok({ cadastrado: true, codigo: entrada.codigo, descricao: entrada.descricao, unidade });
    }

    case 'passar_para_pessoa': {
      acao(r, nome, `Passaria o atendimento para uma pessoa da equipe: ${entrada.motivo}`);
      return ok({ instrucao: AVISOS.instrucaoPessoaChamada });
    }

    default:
      // Leituras não chegam aqui; uma ferramenta nova sem versão simulada não pode gravar de verdade.
      return falha(`Ferramenta indisponível no teste: ${nome}`);
  }
}

export function criarExecutorSimulado(r: Registro): ExecutorFerramentas {
  return async (d, estado, nome, entrada) => {
    const v = validarEntrada(nome, entrada);
    if ('erro' in v) return v;
    if (v.nome === 'ler_skill') acao(r, 'ler_skill', `Leria a skill ${v.dados.nome}`);
    if (LEITURAS.has(v.nome)) return executarFerramenta(d, estado, nome, entrada);
    return simularGravacao(d, estado, v.nome, v.dados, r);
  };
}

const MOTIVOS: Record<string, string> = {
  refusal: 'o modelo se recusou a responder',
  max_tokens: 'a resposta ficou longa demais',
  'terminou sem responder': 'o agente terminou sem responder',
  'limite de iterações': 'o agente passou do número máximo de passos',
};

/** `relogio`: o "agora" do atendimento (expediente, data no contexto). `prazoMs`: prazo total (padrão PRAZO_SIMULACAO_MS), contado no relógio real a partir de `criado_em`. */
export type DepsSimulacao = DepsAgente & { relogio?: () => Date; prazoMs?: number };
export type DesfechoSimulacao = 'inexistente' | 'ja-concluida' | 'pronta' | 'erro';

async function empresaDoTeste(repos: Repos, clienteId: string): Promise<EmpresaDoContato | null> {
  try {
    const e = await repos.dadosDaEmpresa(clienteId);
    // Desativada entre o pedido e o job (criar_simulacao já recusa empresa inativa).
    if (!e.ativo) return null;
    return { id: clienteId, nome: e.nomeFantasia ?? e.razaoSocial, podePedirNota: true, agentePausado: false };
  } catch {
    return null;
  }
}

/**
 * Job da fila `simular_agente` ({ simulacaoId }). Idempotente: só grava enquanto o teste está pendente.
 * Erro temporário da IA antes da última tentativa relança (a fila tenta de novo); qualquer outro erro vira status `erro`
 * com uma mensagem para a pessoa.
 */
export async function processarSimulacao(d: DepsSimulacao, simulacaoId: string, ultimaTentativa: boolean): Promise<DesfechoSimulacao> {
  const sim = await d.repos.simulacaoPorId(simulacaoId);
  if (!sim) return 'inexistente';
  if (sim.status !== 'pendente') return 'ja-concluida';
  const concluirErro = async (erro: string) => { await d.repos.concluirSimulacao(sim.id, { status: 'erro', erro }); return 'erro' as const; };
  // O prazo vale para o teste inteiro: uma nova tentativa (ou um job pego com atraso) não ganha mais tempo.
  const prazoEm = new Date(sim.criado_em).getTime() + (d.prazoMs ?? PRAZO_SIMULACAO_MS);
  if (Date.now() >= prazoEm) return concluirErro(MENSAGEM_PRAZO_SIMULACAO);

  try {
    const agora = (d.relogio ?? (() => new Date()))();
    const config = await d.repos.obterConfiguracoes();
    if ((await d.repos.custoIaDoMes(mesReferencia(agora))) >= config.tetoIaUsd) return await concluirErro(MENSAGEM_TETO_SIMULACAO);

    const empresa = sim.cliente_id ? await empresaDoTeste(d.repos, sim.cliente_id) : null;
    if (sim.cliente_id && !empresa) return await concluirErro(MENSAGEM_EMPRESA_SIMULACAO);

    const r = await simular(d, sim, empresa, config, agora, prazoEm);
    const gravou = await d.repos.concluirSimulacao(sim.id, { status: 'pronta', respostas: r });
    return gravou ? 'pronta' : 'ja-concluida';
  } catch (e) {
    if (erroTemporarioIa(e) && !ultimaTentativa) throw e;
    if (!(e instanceof PrazoEsgotado)) console.error('[simulação] falha', simulacaoId, e);
    return concluirErro(e instanceof PrazoEsgotado ? MENSAGEM_PRAZO_SIMULACAO : MENSAGEM_FALHA_SIMULACAO);
  }
}

async function simular(
  d: DepsSimulacao, sim: SimulacaoAgente, empresa: EmpresaDoContato | null, config: Awaited<ReturnType<Repos['obterConfiguracoes']>>, agora: Date,
  prazoEm: number,
): Promise<RespostasSimulacao> {
  const agoraIso = agora.toISOString();
  // Conversa fictícia: só em memória (id da simulação, que não existe em `conversas`: se algo tentasse gravar, a FK recusaria).
  const conversa = {
    id: sim.id, telefone: TELEFONE_FICTICIO, contato_id: null, cliente_em_foco: empresa?.id ?? null, estado: 'agente',
    atendente_id: null, aviso_lgpd_enviado_em: agoraIso, tentativas_nao_entendido: 0, criado_em: agoraIso, atualizado_em: agoraIso,
    aguardando_pessoa_desde: null, motivo_pessoa: null, concluida_em: null,
  } satisfies Conversa;
  const repos = reposDaSimulacao(d.repos, conversa, await d.repos.obterUsuarioAssistente(sim.usuario_id), sim.usuario_id);
  const deps: DepsAgente = {
    repos,
    ia: iaComPrazo(d.ia, prazoEm),
    envio: { repos, canal: canalBloqueado(), limitador: new LimitadorEnvio(1), midia: midiaBloqueada() },
  };

  const setores = await repos.setoresAtivos();
  const agente = await carregarPerfil(repos, SLUG_ATENDIMENTO, sim.skill_id ?? null);
  const ctx: ContextoAgente = {
    conversa,
    contato: empresa ? { id: `simulacao-${sim.id}`, nome: NOME_FICTICIO, agentePausado: false, empresas: [empresa] } : null,
    empresaEmFoco: empresa,
    setores,
    respostasProntas: await repos.respostasProntas(),
    orientacoes: orientacoesDoTeste(await repos.orientacoesAtivas(agente.id), sim.rascunho, setores, agora),
    servicosContratados: empresa ? await repos.servicosDoCliente(empresa.id) : [],
    noExpediente: estaNoExpediente(agora, config.expediente),
    config,
    agora,
    acessoFixo: acessoTotal(setores),
    agente,
  };

  const registro: Registro = { mensagens: [], acoes: [], observacoes: [], resumos: [], demandas: 0, triagemAberta: false, naoEntendido: 0 };
  const mensagem = {
    id: `simulacao-${sim.id}`, conversa_id: sim.id, cliente_id: empresa?.id ?? null, direcao: 'entrada', autor: 'cliente', tipo: 'texto',
    conteudo: sim.mensagem, criado_em: agoraIso,
  } as unknown as Mensagem;
  const resultado = await executarAgente(deps, ctx, montarConteudoUsuario(ctx, [], [mensagem], []), criarExecutorSimulado(registro));

  observar(registro, sim, ctx, resultado);
  const { mensagens, acoes, observacoes } = registro;
  return { mensagens, acoes, observacoes };
}

/** O que acontece depois do agente (como em processarConversa) e avisos sobre o próprio teste. */
function observar(r: Registro, sim: SimulacaoAgente, ctx: ContextoAgente, resultado: ResultadoAgente): void {
  if (resultado.status === 'escalar') {
    r.acoes.push({ ferramenta: 'encaminhar', resumo: `Passaria o atendimento para a equipe (${MOTIVOS[resultado.motivo] ?? resultado.motivo})` });
    const aviso = (ctx.config.mensagens.ia_indisponivel ?? '').trim();
    if (!resultado.respondeu && aviso) r.mensagens.push(aviso);
  }
  const rascunho = sim.rascunho;
  if (rascunho?.cliente_id && !ctx.empresaEmFoco) {
    r.observacoes.push('A orientação em teste vale só para uma empresa, e nenhuma empresa foi escolhida: ela não entrou neste teste. Escolha a empresa dela para testar.');
  } else if (rascunho?.cliente_id && rascunho.cliente_id !== ctx.empresaEmFoco?.id) {
    r.observacoes.push('A orientação em teste vale só para outra empresa: ela não entrou neste teste. Escolha a empresa dela para testar.');
  }
  if (rascunho?.setor_id && !ctx.setores.some((s) => s.id === rascunho.setor_id)) {
    r.observacoes.push('O setor da orientação em teste está desligado: ela não entrou neste teste.');
  }
  const { cortadas } = orientacoesDaConversa(ctx.orientacoes, { clienteId: ctx.empresaEmFoco?.id ?? null, setores: ctx.setores });
  if (cortadas.length) {
    r.observacoes.push(`${cortadas.length === 1 ? '1 orientação ficou' : `${cortadas.length} orientações ficaram`} de fora por passar do limite de caracteres.`);
  }
  // Teste de skill (aba Testar, D21): avisa se ela entrou desligada e se o agente nem chegou a ler.
  const emTeste = sim.skill_id ? ctx.agente?.skills.find((s) => s.id === sim.skill_id) : undefined;
  if (emTeste && !emTeste.ativa) r.observacoes.push(`A skill “${emTeste.titulo}” entrou neste teste mesmo desligada.`);
  if (emTeste && !['jeito', 'limites'].includes(emTeste.tipo) && !r.acoes.some((a) => a.ferramenta === 'ler_skill' && a.resumo.endsWith(` ${emTeste.nome}`))) {
    r.observacoes.push(`O agente não leu a skill “${emTeste.titulo}” neste teste: ele só lê quando o assunto aparece. Escreva uma mensagem sobre o assunto dela.`);
  }
}
