import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { calcularCustoUsd, usoDaResposta, type ModoContato } from '@escritorio/core';
import type { AgenteSetor } from '@escritorio/db';
import { enviarDoSistema } from '../envio';
import { FERRAMENTA_CHAMAR_AGENTE } from './agentes-setor';
import type { ParametrosIa } from './cliente-ia';
import type { ContextoAgente } from './contexto';
import { ferramentasDoAgenteSetor, montarBlocosEspecialista } from './especialista';
import {
  LIMITE_FERRAMENTAS_RODADA, MENSAGEM_LIMITE_ACOES, NOMES_FERRAMENTAS, contarAcao, executarFerramenta, falha, limiteEstourado, novosContadores, ok, type ContadoresVez, type DepsAgente, type Devolucao, type EstadoExecucao, type ExecutorFerramentas, type OrcamentoVez,
  type Resultado,
} from './ferramentas';
import { LIMITE_ORIENTACOES } from './orientacoes';
import { ferramentasDoPerfil, modeloDoPerfil, perfilDoContexto } from './perfil';
import { montarBlocosSistema } from './prompt';
import { AVISOS_AGENTE, ENVIAM, NOMES_MODO, SEM_CONFERIR_ACESSO, chamarAgente, conferirAcessoDoSetor, ferramentaDoModo, type RodarEspecialista } from './roteamento';

export const MAX_ITERACOES = 6;
const LEMBRETE_RESPONDER =
  'Nada foi enviado ao cliente: texto fora das ferramentas não chega a ele. Use a ferramenta responder para falar com o cliente (ou abra um chamado, se for o caso).';
const LEMBRETE_DEVOLVER =
  'Nada foi entregue ao Thiago: texto fora das ferramentas não chega a ninguém. Use devolver_resposta com a resposta para o cliente.';

/** Parte I2: quem roda — o Thiago (porta de entrada) ou o agente de um setor, num modo (D1). */
export type PapelExecucao = { tipo: 'porta' } | { tipo: 'especialista'; agente: AgenteSetor; modo: ModoContato };
const PORTA: PapelExecucao = { tipo: 'porta' };
/** `acessoConferido`: chamar_agente acabou de conferir o setor do agente para este contato (F4); a condução não passa isso. */
export type OpcoesExecucao = { papel?: PapelExecucao; turno?: string; acessoConferido?: boolean; contadores?: ContadoresVez };
/** `respondeu`: se mandou alguma mensagem ao cliente nesta vez. O Thiago devolve `{ status: 'ok' }` como antes. */
export type ResultadoAgente =
  | { status: 'ok'; respondeu?: boolean; devolucao?: Devolucao }
  | { status: 'escalar'; motivo: string; respondeu: boolean }
  | { status: 'devolvido'; motivo: string; respondeu: boolean };

async function registrarUso(d: DepsAgente, ctx: ContextoAgente, r: Anthropic.Message, papel: PapelExecucao): Promise<void> {
  const especialista = papel.tipo === 'especialista' ? papel.agente : null;
  const perfil = especialista ?? perfilDoContexto(ctx);
  const modelo = modeloDoPerfil(perfil, ctx.config);
  const preco = ctx.config.precosModelos[modelo] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  const uso = usoDaResposta(r.usage);
  const custoUsd = calcularCustoUsd(uso, preco);
  // Conta antes de gravar: a chamada já foi cobrada, mesmo que a gravação falhe (auditoria 4.11).
  if (d.orcamento) d.orcamento.gastoNaVez += custoUsd;
  // A simulação troca o repositório e grava como testar_agente (agente/simular.ts). O agente vai junto (D16 da I1, D10 da I2).
  await d.repos.registrarUsoIa({
    funcionalidade: especialista ? 'especialista_setor' : 'agente_clientes', usuarioId: null, conversaId: ctx.conversa.id,
    clienteId: ctx.empresaEmFoco?.id ?? null, modelo, tokensEntrada: uso.entrada, tokensSaida: uso.saida,
    tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita, custoUsd, agenteId: perfil.id,
  });
}

/** Auditoria 4.11: o telefone passou do limite do dia ou o mês passou do teto com o que esta vez já gastou. */
function passouDoOrcamento(o: OrcamentoVez | undefined): boolean {
  return !!o && (o.telefoneAntes + o.gastoNaVez >= o.limiteDia || o.mesAntes + o.gastoNaVez >= o.tetoMes);
}

/** O pedido de uma rodada (Parte I1): o de antes, com o modelo e as ferramentas do perfil. Mesma ordem de chaves (D2). */
export function montarPedido(ctx: ContextoAgente, messages: Anthropic.MessageParam[], papel: PapelExecucao = PORTA): { pedido: ParametrosIa; cortadas: string[] } {
  if (papel.tipo === 'especialista') {
    return {
      pedido: {
        model: modeloDoPerfil(papel.agente, ctx.config), max_tokens: 16000, system: montarBlocosEspecialista(ctx, papel.agente, papel.modo),
        tools: ferramentasDoAgenteSetor(papel.agente, papel.modo), messages, output_config: { effort: 'medium' },
      },
      cortadas: [],
    };
  }
  const perfil = perfilDoContexto(ctx);
  const { system, cortadas } = montarBlocosSistema(ctx);
  // Parte I2 (D1): chamar_agente no fim, só com agente ativo para o contato. Sem ele, as ferramentas de antes (retratos da I1).
  const tools = ctx.agentesSetor?.length ? [...ferramentasDoPerfil(perfil), FERRAMENTA_CHAMAR_AGENTE] : ferramentasDoPerfil(perfil);
  return {
    pedido: { model: modeloDoPerfil(perfil, ctx.config), max_tokens: 16000, system, tools, messages, output_config: { effort: 'medium' } },
    cortadas,
  };
}

/** Registra as orientações que ficaram de fora do prompt, só quando a lista muda em relação ao último registro da conversa. */
async function registrarCortes(d: DepsAgente, ctx: ContextoAgente, cortadas: string[]): Promise<void> {
  const ordenadas = [...cortadas].sort();
  const anterior = await d.repos.ultimasOrientacoesCortadas(ctx.conversa.id);
  if (anterior && [...anterior].sort().join(',') === ordenadas.join(',')) return;
  await d.repos.registrarDecisao({
    conversaId: ctx.conversa.id, clienteId: ctx.empresaEmFoco?.id ?? null, etapa: 'orientacoes_cortadas',
    entrada: { limite: LIMITE_ORIENTACOES }, saida: { cortadas: ordenadas },
    justificativa: 'Orientações ligadas passaram do limite de caracteres do prompt; as de menor prioridade ficaram de fora.',
  });
}

/**
 * Sobra da I2 (D24e): com a trava ligada (o agente do setor já respondeu), o Thiago não pode mandar o aviso de fora do expediente que
 * abrir_chamado devolve; o sistema manda o texto da configuração, uma vez, e o resultado diz ao Thiago que já foi.
 */
async function avisoForaPeloSistema(d: DepsAgente, estado: EstadoExecucao, r: Resultado): Promise<Resultado> {
  if (r.erro || estado.agenteSetor || !estado.agenteRespondeu || estado.avisoForaEnviado) return r;
  const dados = JSON.parse(r.resultado) as Record<string, unknown>;
  const aviso = typeof dados.aviso_para_o_cliente === 'string' ? dados.aviso_para_o_cliente.trim() : '';
  if (!aviso) return r;
  try {
    await enviarDoSistema(d.envio, {
      conversaId: estado.ctx.conversa.id, telefone: estado.ctx.conversa.telefone, clienteId: estado.ctx.empresaEmFoco?.id ?? null,
      autor: 'agente', texto: aviso, turnoAgente: estado.turno ?? null,
    });
  } catch (e) {
    // Revisão final: o chamado já foi aberto; derrubar a vez faria a fila refazer tudo. A trava segue valendo (o Thiago não manda o aviso).
    console.error('[agente] aviso de fora do expediente não enviado', estado.ctx.conversa.id, e);
    return r;
  }
  estado.avisoForaEnviado = true;
  return ok({ ...dados, aviso_para_o_cliente: null, aviso_ja_enviado: true });
}

/** Uma ferramenta pedida pelo modelo: chamar_agente, as do modo, as duas travas do por trás, o perfil e o acesso ao setor (D7). */
async function despachar(
  d: DepsAgente, estado: EstadoExecucao, u: Anthropic.ToolUseBlock, liberadas: Set<string>, executor: ExecutorFerramentas, rodar: RodarEspecialista,
): Promise<Resultado> {
  if (u.name === 'chamar_agente' && liberadas.has(u.name)) return chamarAgente(d, estado, u.input, rodar);
  if (estado.agenteSetor && NOMES_MODO.has(u.name) && liberadas.has(u.name)) return ferramentaDoModo(d, estado, u.name, u.input);
  if (estado.modo === 'por_tras' && ENVIAM.has(u.name)) return falha(AVISOS_AGENTE.porTrasNaoEnvia);
  // O agente do setor já falou com o cliente e devolveu: o Thiago não manda outra mensagem nesta vez (abrir_chamado segue livre).
  if (!estado.agenteSetor && estado.agenteRespondeu && ENVIAM.has(u.name)) return falha(estado.avisoTrava ?? AVISOS_AGENTE.jaRespondeuDevolveu);
  // I3b (D1b): na mesma rodada do chamar_agente, o que envia foi escrito antes de o agente responder ("Aqui é o Thiago" repetido).
  if (!estado.agenteSetor && estado.agenteFalouNaRodada && ENVIAM.has(u.name)) return falha(AVISOS_AGENTE.mesmaRodada);
  // Ferramenta conhecida fora do perfil não roda (D15 da I1); nome desconhecido segue o caminho de sempre (o executor recusa).
  if (NOMES_FERRAMENTAS.has(u.name) && !liberadas.has(u.name)) return falha(`Ferramenta não liberada para este agente: ${u.name}.`);
  if (estado.agenteSetor && !SEM_CONFERIR_ACESSO.has(u.name)) {
    const recusa = await conferirAcessoDoSetor(d, estado);
    if (recusa) return recusa;
  }
  // Auditoria 5.6: limite de demandas, respostas e documentos por atendimento (os contadores são os mesmos do agente do setor).
  const c = estado.contadores;
  if (c && limiteEstourado(c, u.name)) {
    estado.limiteNaRodada = true;
    return falha(MENSAGEM_LIMITE_ACOES);
  }
  const r = await executor(d, estado, u.name, u.input);
  if (c && !r.erro) contarAcao(c, u.name);
  return u.name === 'abrir_chamado' ? avisoForaPeloSistema(d, estado, r) : r;
}

/** `executor`: a simulação troca as ferramentas que gravam ou enviam. `opcoes.papel`: o agente do setor (Parte I2); sem ele, o Thiago. */
export async function executarAgente(
  d: DepsAgente, ctx: ContextoAgente, conteudo: Anthropic.ContentBlockParam[], executor: ExecutorFerramentas = executarFerramenta,
  opcoes: OpcoesExecucao = {},
): Promise<ResultadoAgente> {
  const papel = opcoes.papel ?? PORTA;
  const especialista = papel.tipo === 'especialista' ? papel : null;
  let cortesVerificados = false;
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: conteudo }];
  // Um turno por vez do Thiago; o agente do setor chamado nele usa o mesmo (o "por quê?" junta os dois).
  const estado: EstadoExecucao = {
    ctx, respondeu: false, contadores: opcoes.contadores ?? novosContadores(), turno: opcoes.turno ?? d.turno ?? randomUUID(), conteudo,
    ...(especialista ? { agenteSetor: especialista.agente, modo: especialista.modo } : {}),
    ...(especialista && opcoes.acessoConferido ? { acessoSetorConferido: true } : {}),
  };
  // Só chamarAgente roda o agente do setor, e só depois de conferir o acesso do contato ao setor dele (F4).
  const rodar: RodarEspecialista = (p, c) => executarAgente(d, ctx, c, executor, { papel: p, turno: estado.turno, acessoConferido: true, contadores: estado.contadores });
  const terminou = (): ResultadoAgente | null => {
    if (estado.devolvido !== undefined) return { status: 'devolvido', motivo: estado.devolvido, respondeu: estado.respondeu };
    if (estado.devolucao) return { status: 'ok', respondeu: false, devolucao: estado.devolucao };
    return null;
  };
  const okFinal = (): ResultadoAgente => (especialista ? { status: 'ok', respondeu: estado.respondeu } : { status: 'ok' });
  let lembrado = false;

  for (let i = 0; i < MAX_ITERACOES; i++) {
    // Revisão geral I2: passado o prazo da vez, não abre outra rodada (a fila repetiria o job com esta vez ainda rodando).
    // Auditoria 4.1: a vez que perdeu a trava (renovação recusada) também para aqui.
    if ((d.prazoVez !== undefined && Date.now() >= d.prazoVez) || d.sinalVez?.aborted) {
      return estado.respondeu ? terminou() ?? okFinal() : { status: 'escalar', motivo: 'tempo esgotado', respondeu: false };
    }
    // Auditoria 4.11: o limite era conferido só na entrada; agora também antes de cada rodada (do Thiago e do agente do setor).
    if (passouDoOrcamento(d.orcamento)) return { status: 'escalar', motivo: 'limite de custo', respondeu: estado.respondeu };
    // A cada rodada: selecionar_empresa pode ter trocado a empresa em foco (e com ela as orientações da empresa).
    const { pedido, cortadas } = montarPedido(ctx, messages, papel);
    const r = await d.ia.criar(pedido);
    await registrarUso(d, ctx, r, papel);
    // Só depois de a IA responder: o registro não pode contar como "o agente já agiu" numa falha temporária antes disso.
    if (cortadas.length && !cortesVerificados) {
      cortesVerificados = true;
      await registrarCortes(d, ctx, cortadas);
    }

    if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') return { status: 'escalar', motivo: r.stop_reason, respondeu: estado.respondeu };
    const usos = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || usos.length === 0) {
      // Por trás termina ao entregar a resposta; nos outros, ao falar com o cliente.
      if (especialista?.modo === 'por_tras' ? estado.devolucao !== undefined : estado.respondeu) return terminou() ?? okFinal();
      // Às vezes o modelo escreve a resposta como texto em vez de usar a ferramenta: um lembrete antes de escalar.
      // Sem lembrete se já lembrou, ou se um atendente assumiu a conversa (aí o agente não deve falar).
      if (lembrado || (await d.repos.obterConversa(ctx.conversa.id)).estado === 'humano') {
        return { status: 'escalar', motivo: 'terminou sem responder', respondeu: estado.respondeu };
      }
      lembrado = true;
      messages.push({ role: 'assistant', content: r.content });
      messages.push({ role: 'user', content: [{ type: 'text', text: especialista?.modo === 'por_tras' ? LEMBRETE_DEVOLVER : LEMBRETE_RESPONDER }] });
      continue;
    }

    messages.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    const liberadas = new Set((pedido.tools ?? []).map((t) => (t as Anthropic.Tool).name));
    // Em ordem: selecionar_empresa precisa valer antes de abrir_chamado na mesma rodada.
    // I3b (D1b): com chamar_agente na rodada, o que envia ao cliente roda depois dele (o resto segue a ordem do modelo:
    // selecionar_empresa precisa valer antes de abrir_chamado e do próprio chamar_agente). Os resultados voltam na ordem do modelo.
    // F15: só quando chamar_agente foi oferecido; sem agente ativo, a ordem do Thiago é a de antes.
    const ordem = usos.some((u) => u.name === 'chamar_agente' && liberadas.has(u.name))
      ? [...usos.filter((u) => !ENVIAM.has(u.name)), ...usos.filter((u) => ENVIAM.has(u.name))]
      : usos;
    estado.agenteFalouNaRodada = false;
    const porId = new Map<string, Resultado>();
    estado.limiteNaRodada = false;
    let nesta = 0;
    for (const u of ordem) {
      // Auditoria 5.6: da 11ª ferramenta da rodada em diante só volta a recusa (todo tool_use precisa do seu tool_result).
      if (++nesta > LIMITE_FERRAMENTAS_RODADA) { porId.set(u.id, falha(MENSAGEM_LIMITE_ACOES)); continue; }
      porId.set(u.id, await despachar(d, estado, u, liberadas, executor, rodar));
    }
    estado.agenteFalouNaRodada = false;
    for (const u of usos) {
      const res = porId.get(u.id)!;
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.resultado, is_error: res.erro });
    }
    messages.push({ role: 'user', content: resultados });
    // Auditoria 5.6: o limite já tinha sido devolvido numa rodada anterior e o modelo pediu de novo: escala a vez.
    if (estado.limiteNaRodada && estado.contadores) {
      if (estado.contadores.recusou) return { status: 'escalar', motivo: 'limite de ações', respondeu: estado.respondeu };
      estado.contadores.recusou = true;
    }
    const fim = terminou();
    if (fim) return fim;
  }
  return estado.respondeu ? okFinal() : { status: 'escalar', motivo: 'limite de iterações', respondeu: false };
}
