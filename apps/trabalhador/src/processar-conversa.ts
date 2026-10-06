import { MOTIVOS_PASSAGEM, custoTranscricaoUsd, empresaDoUso, mesReferencia, motivoDaEscalada } from '@escritorio/core';
import type { Conversa, Mensagem } from '@escritorio/db';
import type { Alertas } from './alertas';
import { atenderComAgentes, avisarRespostaAosPedidos } from './agente/atender';
import { erroTemporarioIa } from './agente/cliente-ia';
import { carregarContexto } from './agente/contexto';
import type { DepsAgente } from './agente/ferramentas';
import { montarConteudoUsuario, type AnexoParaIa } from './agente/prompt';
import { enviarDoSistema } from './envio';
import { ESPERA_OCUPADA_SEGUNDOS, FILAS, TRAVA_VEZ_SEGUNDOS, agendarAssistente, naVez, type Fila } from './fila';
import type { ArmazenamentoMidia } from './midia/armazenamento';
import type { Transcricao, Transcritor } from './midia/transcritor';

export type DepsProcessamento = DepsAgente & { transcritor: Transcritor; midia: ArmazenamentoMidia; alertas: Alertas; relogio: () => Date; fila: Fila };
export type DesfechoProcessamento = 'sem-mensagens' | 'assistente' | 'interno' | 'humano' | 'pausado' | 'teto' | 'agente' | 'escalado';

const TAMANHO_HISTORICO = 20;
/** Revisão geral I2: a vez do agente para de abrir rodadas depois disto (bem abaixo do prazo do job, EXPIRA_CONVERSA_SEGUNDOS). */
export const PRAZO_VEZ_CONVERSA_MS = 7 * 60_000;
const MAX_BYTES_ANEXO = 5 * 1024 * 1024;
const IMAGENS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const AVISO_ANEXO_FALHOU = '[anexo não pôde ser baixado]';

function anexoParaIa(m: Mensagem, bytes: Uint8Array, mimeCompleto: string, nome: string): AnexoParaIa | null {
  if (bytes.length > MAX_BYTES_ANEXO) return null;
  const mime = mimeCompleto.split(';')[0]!;
  const base64 = Buffer.from(bytes).toString('base64');
  if (m.tipo === 'imagem' && IMAGENS.includes(mime)) return { tipo: 'imagem', mime, base64, nome };
  if (m.tipo === 'documento' && mime === 'application/pdf') return { tipo: 'documento', mime, base64, nome };
  return null;
}

const AVISO_AUDIO_FALHOU = '[áudio não pôde ser transcrito]';
/** Para onde vai o custo de uma transcrição (uso_ia.conversa_id e cliente_id). */
type DestinoCusto = { conversaId: string | null; clienteId: string | null };

/** Transcreve e grava o custo (spec 7B.2). Falha do fornecedor não é cobrada: só o aviso. Falha ao gravar o custo não perde o áudio. */
async function transcrever(d: DepsProcessamento, conversa: Conversa, custo: DestinoCusto, bytes: Uint8Array, mime: string, nome: string): Promise<string> {
  let r: Transcricao;
  try {
    r = await d.transcritor.transcrever(bytes, mime, nome);
  } catch {
    return AVISO_AUDIO_FALHOU;
  }
  try {
    const config = await d.repos.obterConfiguracoes();
    await d.repos.registrarUsoIa({
      funcionalidade: 'transcricao_audio', usuarioId: null, conversaId: custo.conversaId, clienteId: custo.clienteId,
      modelo: d.transcritor.modelo, provedor: d.transcritor.provedor, tokensEntrada: 0, tokensSaida: 0, tokensCacheLeitura: 0, tokensCacheEscrita: 0,
      segundosAudio: r.segundos, custoUsd: custoTranscricaoUsd(r.segundos, config.custoMinutoTranscricaoUsd),
    });
  } catch (e) {
    console.error('[mídia] falha ao gravar o custo da transcrição', conversa.id, e);
  }
  return r.texto;
}

async function prepararMidias(d: DepsProcessamento, conversa: Conversa, novas: Mensagem[], custo: DestinoCusto): Promise<AnexoParaIa[]> {
  const anexos: AnexoParaIa[] = [];
  for (const m of novas) {
    const nome = m.arquivo_nome ?? (m.tipo === 'audio' ? 'audio.ogg' : m.tipo === 'imagem' ? 'imagem.jpg' : 'arquivo');
    // Nova tentativa: a imagem ou o PDF já foi salvo na primeira; lê de volta para o agente continuar vendo.
    if (m.arquivo_path) {
      if (m.tipo === 'imagem' || m.tipo === 'documento') {
        const bytes = await d.midia.ler(m.arquivo_path).catch(() => null);
        const anexo = bytes && anexoParaIa(m, bytes, m.arquivo_mime ?? '', nome);
        if (anexo) anexos.push(anexo);
      }
      continue;
    }
    if (!m.midia_url_origem) continue;
    try {
      const salvo = await d.midia.baixarESalvar(m.midia_url_origem, conversa.id, nome, m.arquivo_mime);
      const patch: Partial<Mensagem> = { arquivo_path: salvo.path, arquivo_mime: salvo.mime };
      if (m.tipo === 'audio') {
        patch.transcricao = await transcrever(d, conversa, custo, salvo.bytes, salvo.mime.split(';')[0]!, nome);
        m.transcricao = patch.transcricao;
      } else {
        const anexo = anexoParaIa(m, salvo.bytes, salvo.mime, nome);
        if (anexo) anexos.push(anexo);
      }
      await d.repos.atualizarMensagem(m.id, patch);
    } catch (e) {
      console.error('[mídia] falha ao preparar', m.id, e);
      // O agente precisa saber que o arquivo não veio; e a origem sai para não tentar (e avisar) de novo.
      m.conteudo = `${m.conteudo ?? ''} ${AVISO_ANEXO_FALHOU}`.trim();
      m.midia_url_origem = null;
      await d.repos.atualizarMensagem(m.id, { conteudo: m.conteudo, midia_url_origem: null });
    }
  }
  return anexos;
}

async function encaminharParaHumano(d: Pick<DepsProcessamento, 'repos' | 'envio'>, conversa: Conversa, motivo: string, textoCliente: string | null): Promise<void> {
  const abertos = await d.repos.chamadosAbertosDaConversa(conversa.id);
  if (!abertos.some((c) => c.setor_id === null)) {
    await d.repos.abrirChamado({
      clienteId: conversa.cliente_em_foco, conversaId: conversa.id, setorId: null, responsavelId: null,
      titulo: motivo, resumo: 'Atendimento encaminhado automaticamente para a equipe.', foraDoContrato: false, origem: 'sistema',
    });
  }
  if (textoCliente) {
    const ultimas = await d.repos.historico(conversa.id, 5);
    const jaAvisado = ultimas.some((m) => m.direcao === 'saida' && m.conteudo === textoCliente);
    if (!jaAvisado) {
      // Falha de envio aqui não relança o job: relançar repetiria ferramentas já executadas (chamado duplicado).
      await enviarDoSistema(d.envio, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: conversa.cliente_em_foco, autor: 'sistema', texto: textoCliente })
        .catch((e) => console.error('[encaminhar] aviso ao cliente não enviado', e));
    }
  }
}

/** Se um atendente assumiu durante o processamento, o sistema não fala mais nada com o cliente. */
async function assumidaPorHumano(d: DepsProcessamento, conversaId: string): Promise<boolean> {
  return (await d.repos.obterConversa(conversaId)).estado === 'humano';
}

/** O agente passou para uma pessoa (spec 7A.2). Falha ao marcar não refaz o atendimento (relançar repetiria ferramentas). */
async function marcarPassagem(d: Pick<DepsProcessamento, 'repos'>, conversaId: string, motivo: string): Promise<void> {
  await d.repos.marcarAguardandoPessoa(conversaId, motivo).catch((e) => console.error('[passagem] não marcada', conversaId, e));
}

/**
 * Revisão geral C1: passa à equipe a conversa cujas mensagens o agente não vai atender (falha antes do agente na última
 * tentativa, ou o batimento depois de 2 devoluções): Triagem, "esperando pessoa", o aviso "IA indisponível" e as mensagens
 * marcadas. Conversa já com a equipe: só marca. Telefone da equipe (assistente) ou interno: só marca (não é atendimento).
 */
export async function passarAEquipeSemResposta(
  d: Pick<DepsProcessamento, 'repos' | 'envio'>, conversaId: string, motivoChamado: string, motivoPassagem: string,
): Promise<'humano' | 'escalado' | 'interno'> {
  const ids = (await d.repos.mensagensNaoProcessadas(conversaId)).map((m) => m.id);
  const conversa = await d.repos.obterConversa(conversaId);
  if (conversa.estado === 'humano') {
    await d.repos.marcarProcessadas(ids);
    return 'humano';
  }
  if ((await d.repos.usuarioDoAssistente(conversa.telefone)) || (await d.repos.ehTelefoneInterno(conversa.telefone))) {
    await d.repos.marcarProcessadas(ids);
    return 'interno';
  }
  const aviso = await d.repos.obterConfiguracoes().then((c) => c.mensagens.ia_indisponivel ?? null)
    .catch((e) => { console.error('[agente] configurações não lidas; passa à equipe sem aviso', conversaId, e); return null; });
  await encaminharParaHumano(d, conversa, motivoChamado, aviso);
  await marcarPassagem(d, conversa.id, motivoPassagem);
  await d.repos.marcarProcessadas(ids);
  return 'escalado';
}

export async function processarConversa(d: DepsProcessamento, conversaId: string, ultimaTentativa: boolean): Promise<DesfechoProcessamento> {
  try {
    return await processarConversaSemProtecao(d, conversaId, ultimaTentativa);
  } catch (e) {
    // Revisão geral C1: na última tentativa, a falha ANTES do agente (banco, mídia, contexto) passa a conversa à equipe em vez
    // de deixar a mensagem sem resposta. Falha ao marcar depois do agente segue como antes (o cliente já foi atendido).
    if (e instanceof ErroDepoisDoAgente) throw e.causa;
    if (!ultimaTentativa) throw e;
    console.error('[agente] falha antes do agente na última tentativa; passa à equipe', conversaId, e);
    try {
      return await passarAEquipeSemResposta(d, conversaId, 'Falha no agente de IA', MOTIVOS_PASSAGEM.falha);
    } catch (e2) {
      // Nem isso: a mensagem segue não processada e o batimento tenta de novo (mensagensParadas).
      console.error('[agente] não passou à equipe', conversaId, e2);
      throw e;
    }
  }
}

/** Erro ao marcar as mensagens depois que o agente já agiu: não vira passagem à equipe (o cliente já foi atendido). */
class ErroDepoisDoAgente extends Error {
  constructor(readonly causa: unknown) { super('falha depois do agente'); }
}

async function processarConversaSemProtecao(d: DepsProcessamento, conversaId: string, ultimaTentativa: boolean): Promise<DesfechoProcessamento> {
  // O prazo conta do começo do job (baixar mídia e transcrever também gastam o tempo do job).
  const inicio = Date.now();
  const novas = await d.repos.mensagensNaoProcessadas(conversaId);
  if (novas.length === 0) return 'sem-mensagens';
  const ids = novas.map((m) => m.id);
  let conversa = await d.repos.obterConversa(conversaId);
  // Quem fala decide o custo da transcrição (revisão final, I1/I3): áudio da equipe ou de telefone interno entra só no total
  // (sem conversa, empresa nem pessoa: não é atendimento nem ação de alguém); de cliente, a conversa e a empresa da regra única.
  const usuario = await d.repos.usuarioDoAssistente(conversa.telefone);
  const interno = !usuario && (await d.repos.ehTelefoneInterno(conversa.telefone));
  const contato = usuario || interno ? null : await d.repos.buscarContato(conversa.telefone);
  const custoAudio: DestinoCusto = usuario || interno ? { conversaId: null, clienteId: null }
    : { conversaId: conversa.id, clienteId: empresaDoUso(conversa.cliente_em_foco, contato?.empresas ?? []) };
  const anexos = await prepararMidias(d, conversa, novas, custoAudio);

  // WhatsApp de alguém da equipe com o assistente ligado: vira pergunta ao assistente interno (pedido do dono, 2026-09-29).
  // `prepararMidias` já preencheu `transcricao` nas linhas em memória (e em nova tentativa ela vem do banco).
  if (usuario) {
    for (const m of novas) {
      const texto = m.tipo === 'audio' ? m.transcricao ?? '[áudio sem transcrição]'
        : m.tipo === 'imagem' ? `[imagem]${m.conteudo ? ` ${m.conteudo}` : ''}`
        : m.tipo === 'documento' ? `[documento: ${m.arquivo_nome ?? 'arquivo'}]${m.conteudo ? ` ${m.conteudo}` : ''}`
        : m.conteudo ?? '';
      if (texto.trim()) await d.repos.registrarMensagemAssistente({ usuarioId: usuario.id, canal: 'whatsapp', conversaId: null, papel: 'usuario', conteudo: texto });
    }
    // Agenda antes de marcar: se o agendamento falhar, a mensagem continua pendente e a fila tenta de novo.
    await agendarAssistente(d.fila, { usuarioId: usuario.id, canal: 'whatsapp', conversaId: null, telefone: conversa.telefone });
    await d.repos.marcarProcessadas(ids);
    return 'assistente';
  }

  if (interno) {
    await d.repos.marcarProcessadas(ids);
    return 'interno';
  }
  if (conversa.estado === 'humano') {
    // Parte I3a (D26, revisão final): o Thiago fica calado, mas a tarefa fica sabendo que o contato respondeu ao pedido.
    if (contato) {
      const pedidos = await d.repos.pendenciasPedidasAoContato(contato.id)
        .catch((e) => { console.error('[tarefa] pedidos ao contato não lidos', conversa.id, e); return null; });
      await avisarRespostaAosPedidos(d.repos, conversa.id, contato.id, pedidos);
    }
    await d.repos.marcarProcessadas(ids);
    return 'humano';
  }

  const config = await d.repos.obterConfiguracoes();

  if (!conversa.aviso_lgpd_enviado_em) {
    // O texto é do dono (Configurações → Mensagens automáticas); vazio = não enviar aviso.
    const aviso = (config.mensagens.aviso_lgpd ?? '').trim();
    if (aviso) await enviarDoSistema(d.envio, { conversaId, telefone: conversa.telefone, clienteId: conversa.cliente_em_foco, autor: 'sistema', texto: aviso });
    await d.repos.atualizarConversa(conversaId, { aviso_lgpd_enviado_em: d.relogio().toISOString() });
  }

  const ctx = await carregarContexto(d.repos, conversa, contato, config, d.relogio());
  conversa = ctx.conversa = await d.repos.obterConversa(conversaId);

  const empresas = contato?.empresas ?? [];
  const pausado = config.agentePausado || contato?.agentePausado === true || ctx.empresaEmFoco?.agentePausado === true
    || (empresas.length > 0 && empresas.every((e) => e.agentePausado));
  if (pausado) {
    await avisarRespostaAosPedidos(d.repos, conversa.id, ctx.contato?.id, ctx.pedidosAoContato);
    // Pausado não manda nada ao cliente (decisão do dono, 2026-09-28): a equipe vê a mensagem e a triagem no painel.
    const motivo = contato?.agentePausado ? 'Agente desligado para este contato: atender manualmente' : 'Agente pausado: atender manualmente';
    await encaminharParaHumano(d, conversa, motivo, null);
    const empresaPausada = ctx.empresaEmFoco?.agentePausado === true || (empresas.length > 0 && empresas.every((e) => e.agentePausado));
    await marcarPassagem(d, conversa.id, contato?.agentePausado ? MOTIVOS_PASSAGEM.pausaContato
      : empresaPausada ? MOTIVOS_PASSAGEM.pausaEmpresa : MOTIVOS_PASSAGEM.pausaGeral);
    await d.repos.marcarProcessadas(ids);
    return 'pausado';
  }

  const mes = mesReferencia(d.relogio());
  if ((await d.repos.custoIaDoMes(mes)) >= config.tetoIaUsd) {
    await avisarRespostaAosPedidos(d.repos, conversa.id, ctx.contato?.id, ctx.pedidosAoContato);
    await encaminharParaHumano(d, conversa, 'Limite mensal de gasto com IA atingido', config.mensagens.ia_indisponivel ?? null);
    await marcarPassagem(d, conversa.id, MOTIVOS_PASSAGEM.teto);
    await d.repos.marcarProcessadas(ids);
    return 'teto';
  }

  const historico = (await d.repos.historico(conversaId, TAMANHO_HISTORICO + novas.length)).filter((m) => !ids.includes(m.id)).slice(-TAMANHO_HISTORICO);
  // Só as mensagens deste lote (já com transcrição): as que chegarem durante o processamento ficam para o próximo job.
  let desfecho: DesfechoProcessamento = 'agente';
  let agenteAgiu = false;
  try {
    const r = await atenderComAgentes({ ...d, prazoVez: inicio + PRAZO_VEZ_CONVERSA_MS }, ctx, montarConteudoUsuario(ctx, historico, novas, anexos));
    agenteAgiu = true;
    if (r.status === 'escalar') {
      if (await assumidaPorHumano(d, conversaId)) {
        desfecho = 'humano';
      } else {
        // Só conta resposta deste turno: uma mensagem antiga do agente no histórico não é resposta ao pedido novo.
        await encaminharParaHumano(d, conversa, `Agente encaminhou: ${r.motivo}`, r.respondeu ? null : config.mensagens.ia_indisponivel ?? null);
        await marcarPassagem(d, conversa.id, motivoDaEscalada(r.motivo));
        desfecho = 'escalado';
      }
    }
  } catch (e) {
    // Só relança (nova tentativa) se a IA falhou antes de qualquer ação; depois disso, relançar repetiria ferramentas.
    if (!agenteAgiu && erroTemporarioIa(e) && !ultimaTentativa && (await d.repos.contarDecisoesDesde(conversaId, novas[0]!.criado_em)) === 0) throw e;
    console.error('[agente] falha', e);
    if (await assumidaPorHumano(d, conversaId)) {
      desfecho = 'humano';
    } else {
      await encaminharParaHumano(d, conversa, 'Falha no agente de IA', config.mensagens.ia_indisponivel ?? null);
      await marcarPassagem(d, conversa.id, MOTIVOS_PASSAGEM.falha);
      desfecho = 'escalado';
    }
  }
  try {
    await d.repos.marcarProcessadas(ids);
    if (config.alertaIa80Mes !== mes && (await d.repos.custoIaDoMes(mes)) >= 0.8 * config.tetoIaUsd) {
      await d.alertas.alertar({ nivel: 'operacional', mensagem: `O gasto com IA do mês passou de 80% do teto (US$ ${config.tetoIaUsd}).` });
      await d.repos.marcarAlertaIa80(mes);
    }
  } catch (e) {
    throw new ErroDepoisDoAgente(e);
  }
  return desfecho;
}

/** Revisão geral I1: uma vez por conversa (trava no banco, a mesma chave que o batimento confere); ocupada, volta para a fila mais tarde. */
export async function processarConversaNaVez(d: DepsProcessamento, conversaId: string, ultimaTentativa: boolean) {
  return naVez(d.repos, `conversa:${conversaId}`, TRAVA_VEZ_SEGUNDOS, () => processarConversa(d, conversaId, ultimaTentativa),
    () => d.fila.enviar(FILAS.processarConversa, { conversaId }, { singletonKey: conversaId, startAfter: ESPERA_OCUPADA_SEGUNDOS }));
}
