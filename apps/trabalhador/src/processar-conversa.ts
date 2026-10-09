import { randomUUID } from 'node:crypto';
import { MOTIVOS_PASSAGEM, custoTranscricaoUsd, empresaDoUso, mesReferencia, motivoDaEscalada } from '@escritorio/core';
import { PREFIXO_TENTATIVA_IA80, type Conversa, type Mensagem } from '@escritorio/db';
import type { Alertas } from './alertas';
import { atenderComAgentes, avisarRespostaAosPedidos } from './agente/atender';
import { erroTemporarioIa } from './agente/cliente-ia';
import { carregarContexto } from './agente/contexto';
import type { DepsAgente } from './agente/ferramentas';
import { montarConteudoUsuario, type AnexoParaIa } from './agente/prompt';
import { enviarDoSistema } from './envio';
import { ESPERA_OCUPADA_SEGUNDOS, FILAS, TRAVA_VEZ_SEGUNDOS, agendarAssistente, naVez, type Fila } from './fila';
import { ArquivoGrandeDemais, type ArmazenamentoMidia } from './midia/armazenamento';
import { AVISO_AUDIO_LONGO, audioLongoDemais, cortarTranscricao, type Transcricao, type Transcritor } from './midia/transcritor';

export type DepsProcessamento = DepsAgente & { transcritor: Transcritor; midia: ArmazenamentoMidia; alertas: Alertas; relogio: () => Date; fila: Fila };
export type DesfechoProcessamento = 'sem-mensagens' | 'assistente' | 'interno' | 'humano' | 'pausado' | 'teto' | 'limite' | 'agente' | 'escalado' | 'volume'
  /** Revisão da Task 7: a vez perdeu a trava (outra pode estar rodando); não escreve mais nada, a retomada cuida do lote. */
  | 'trava-perdida';

const TAMANHO_HISTORICO = 20;
/** Auditoria 1.10: até quantos dias de histórico vão ao modelo quando o número é desconhecido. */
const DIAS_HISTORICO_DESCONHECIDO = 30;

/** O mais recente entre 30 dias atrás e a última troca de contato da conversa. */
function inicioDoHistoricoDesconhecido(conversa: Conversa, agora: number): string {
  const troca = conversa.contato_trocado_em ? Date.parse(conversa.contato_trocado_em) : 0;
  return new Date(Math.max(agora - DIAS_HISTORICO_DESCONHECIDO * 86_400_000, troca)).toISOString();
}
/** Revisão geral I2: a vez do agente para de abrir rodadas depois disto (bem abaixo do prazo do job, EXPIRA_CONVERSA_SEGUNDOS). */
export const PRAZO_VEZ_CONVERSA_MS = 7 * 60_000;
/** Revisão geral I4: mais que isto de mensagens do agente na conversa nos últimos minutos = laço com resposta automática. */
export const LIMITE_VOLUME = { saidas: 15, minutos: 10 } as const;
const MAX_BYTES_ANEXO = 5 * 1024 * 1024;
const IMAGENS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const AVISO_ANEXO_FALHOU = '[anexo não pôde ser baixado]';
// Revisão geral I6: acima do limite o arquivo nem é baixado; o agente sabe o motivo (e passa à equipe se precisar dele).
const AVISO_ANEXO_GRANDE = '[anexo grande demais: não foi aberto]';

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
/** Revisão da Task 6: número acima do limite do dia (ou mês no teto) não paga transcrição; o áudio fica salvo para a equipe. */
const AVISO_AUDIO_SEM_VERBA = '[áudio não transcrito: limite diário]';

async function transcrever(
  d: DepsProcessamento, conversa: Conversa, custo: DestinoCusto, bytes: Uint8Array, mime: string, nome: string, semVerba: boolean,
): Promise<string> {
  if (semVerba) return AVISO_AUDIO_SEM_VERBA;
  // Auditoria 5.7: áudio de mais de 10 min nem vai ao fornecedor; o arquivo fica salvo para a equipe ouvir.
  if (audioLongoDemais(bytes)) return AVISO_AUDIO_LONGO;
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
  // Auditoria 5.7: a transcrição vai em cada rodada e no histórico das próximas vezes.
  return cortarTranscricao(r.texto);
}

/** Auditoria 4.5 e 5.2: no máximo isto de imagens e PDFs vai ao modelo por vez (cinco PDFs grandes já passam do limite da API). */
export const MAX_ANEXOS_POR_VEZ = 5;
const AVISO_MUITOS_ANEXOS = '[anexo não aberto: muitos arquivos de uma vez]';

/** Auditoria 4.4: passado o prazo da vez, a mídia que falta nem é baixada; o agente (ou a equipe) sabe que ela veio. */
const AVISO_ANEXO_TEMPO = '[anexo não aberto: tempo]';

async function avisarSemTempo(d: DepsProcessamento, m: Mensagem): Promise<void> {
  if (m.conteudo?.includes(AVISO_ANEXO_TEMPO)) return;
  m.conteudo = `${m.conteudo ?? ''} ${AVISO_ANEXO_TEMPO}`.trim();
  await d.repos.atualizarMensagem(m.id, { conteudo: m.conteudo });
}

/** O anexo que passou do limite fica salvo e o agente sabe que ele veio. O aviso não se repete numa nova tentativa. */
async function avisarAnexoNaoAberto(d: DepsProcessamento, m: Mensagem): Promise<void> {
  if (m.conteudo?.includes(AVISO_MUITOS_ANEXOS)) return;
  m.conteudo = `${m.conteudo ?? ''} ${AVISO_MUITOS_ANEXOS}`.trim();
  await d.repos.atualizarMensagem(m.id, { conteudo: m.conteudo });
}

async function prepararMidias(
  d: DepsProcessamento, conversa: Conversa, novas: Mensagem[], custo: DestinoCusto, semVerba = false, prazo = Number.POSITIVE_INFINITY,
): Promise<AnexoParaIa[]> {
  const anexos: AnexoParaIa[] = [];
  const guardar = async (m: Mensagem, anexo: AnexoParaIa | null | undefined) => {
    if (!anexo) return;
    if (anexos.length < MAX_ANEXOS_POR_VEZ) anexos.push(anexo);
    else await avisarAnexoNaoAberto(d, m);
  };
  for (const m of novas) {
    const nome = m.arquivo_nome ?? (m.tipo === 'audio' ? 'audio.ogg' : m.tipo === 'imagem' ? 'imagem.jpg' : 'arquivo');
    // Nova tentativa: a imagem ou o PDF já foi salvo na primeira; lê de volta para o agente continuar vendo.
    if (m.arquivo_path) {
      if (m.tipo === 'imagem' || m.tipo === 'documento') {
        // Já passou do limite na primeira tentativa: nem lê o arquivo.
        if (anexos.length >= MAX_ANEXOS_POR_VEZ || m.conteudo?.includes(AVISO_MUITOS_ANEXOS)) {
          await avisarAnexoNaoAberto(d, m);
          continue;
        }
        const bytes = await d.midia.ler(m.arquivo_path).catch(() => null);
        await guardar(m, bytes && anexoParaIa(m, bytes, m.arquivo_mime ?? '', nome));
      }
      continue;
    }
    if (!m.midia_url_origem) continue;
    // Auditoria 4.4: o download e a transcrição contam no prazo da vez (antes, só as rodadas do agente contavam).
    if (Date.now() >= prazo || d.sinalVez?.aborted) {
      await avisarSemTempo(d, m);
      continue;
    }
    try {
      const salvo = await d.midia.baixarESalvar(m.midia_url_origem, conversa.id, nome, m.arquivo_mime);
      const patch: Partial<Mensagem> = { arquivo_path: salvo.path, arquivo_mime: salvo.mime };
      if (m.tipo === 'audio') {
        patch.transcricao = await transcrever(d, conversa, custo, salvo.bytes, salvo.mime.split(';')[0]!, nome, semVerba);
        m.transcricao = patch.transcricao;
      }
      await d.repos.atualizarMensagem(m.id, patch);
      if (m.tipo !== 'audio') await guardar(m, anexoParaIa(m, salvo.bytes, salvo.mime, nome));
    } catch (e) {
      console.error('[mídia] falha ao preparar', m.id, e);
      // O agente precisa saber que o arquivo não veio; e a origem sai para não tentar (e avisar) de novo.
      m.conteudo = `${m.conteudo ?? ''} ${e instanceof ArquivoGrandeDemais ? AVISO_ANEXO_GRANDE : AVISO_ANEXO_FALHOU}`.trim();
      m.midia_url_origem = null;
      await d.repos.atualizarMensagem(m.id, { conteudo: m.conteudo, midia_url_origem: null });
    }
  }
  return anexos;
}

/**
 * Auditoria 1.4 e 3.9: a empresa gravada na conversa só vale se ainda é do contato (empresaDoUso), também fora do motor.
 * Sem conseguir ler o contato, nenhuma: melhor uma demanda sem empresa que na empresa errada.
 */
async function empresaDaConversa(d: Pick<DepsProcessamento, 'repos'>, conversa: Conversa): Promise<string | null> {
  try {
    const contato = await d.repos.buscarContato(conversa.telefone);
    return empresaDoUso(conversa.cliente_em_foco, contato?.empresas ?? []);
  } catch (e) {
    console.error('[encaminhar] contato não lido; demanda sem empresa', conversa.id, e);
    return null;
  }
}

async function encaminharParaHumano(
  d: Pick<DepsProcessamento, 'repos' | 'envio'>, conversa: Conversa, motivo: string, textoCliente: string | null, abrirTriagem = true,
): Promise<void> {
  const clienteId = await empresaDaConversa(d, conversa);
  const abertos = abrirTriagem ? await d.repos.chamadosAbertosDaConversa(conversa.id) : [];
  // A Triagem aberta de outra empresa não basta: abre a desta (a mesma regra de abrir_chamado, auditoria 1.5).
  if (abrirTriagem && !abertos.some((c) => c.setor_id === null && c.cliente_id === clienteId)) {
    await d.repos.abrirChamado({
      clienteId, conversaId: conversa.id, setorId: null, responsavelId: null,
      titulo: motivo, resumo: 'Atendimento encaminhado automaticamente para a equipe.', foraDoContrato: false, origem: 'sistema',
    });
  }
  if (textoCliente) {
    const ultimas = await d.repos.historico(conversa.id, 5);
    const jaAvisado = ultimas.some((m) => m.direcao === 'saida' && m.conteudo === textoCliente);
    if (!jaAvisado) {
      // Falha de envio aqui não relança o job: relançar repetiria ferramentas já executadas (chamado duplicado).
      await enviarDoSistema(d.envio, { conversaId: conversa.id, telefone: conversa.telefone, clienteId, autor: 'sistema', texto: textoCliente })
        .catch((e) => console.error('[encaminhar] aviso ao cliente não enviado', e));
    }
  }
}

/**
 * Auditoria 3.12 e 4.16: o aviso de privacidade sai uma vez. Marca antes e envia depois; só quem marcou envia (duas vezes
 * ao mesmo tempo na conversa nova mandam um só). Resultado incerto conta como enviado (melhor perder um aviso numa falha
 * rara que mandar dois). Falha certa (não saiu): desmarca e o erro segue, para a nova tentativa mandar.
 * `clienteId`: a empresa da regra única (empresaDoUso), nunca o foco gravado sem conferir (auditoria 1.4).
 */
export async function enviarAvisoLgpd(
  d: Pick<DepsProcessamento, 'repos' | 'envio'>, conversa: Conversa, aviso: string, clienteId: string | null = null,
): Promise<void> {
  if (conversa.aviso_lgpd_enviado_em) return;
  if (!(await d.repos.marcarAvisoLgpd(conversa.id))) return;
  const texto = aviso.trim();
  if (!texto) return;
  try {
    // Revisão da Task 9: fora do limite de avisos (um por conversa): sai na hora, antes da resposta, e nunca fica na fila.
    await enviarDoSistema(d.envio, { conversaId: conversa.id, telefone: conversa.telefone, clienteId, autor: 'sistema', texto,
      semLimite: true });
  } catch (e) {
    // Falha certa: a mensagem ficou "falhou" (não saiu); desmarca para a nova tentativa mandar.
    await d.repos.desmarcarAvisoLgpd(conversa.id).catch((e2) => console.error('[lgpd] marca do aviso não desfeita', conversa.id, e2));
    throw e;
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

/**
 * Auditoria 4.1: o lote de um turno que caiu depois de agir (decisão ou resposta gravada). A IA não é chamada de novo: o
 * resultado da vez é incerto e uma pessoa confere. A demanda que o turno já abriu basta; sem nenhuma, a Triagem. O aviso
 * "IA indisponível" só sai se nenhuma resposta daquele turno saiu.
 */
async function retomarInterrompida(
  d: DepsProcessamento, conversaId: string, interrompidas: Mensagem[], respondeu: boolean,
): Promise<DesfechoProcessamento> {
  const ids = interrompidas.map((m) => m.id);
  console.warn('[agente] vez interrompida: retomada sem chamar a IA de novo', conversaId, ids.length);
  const conversa = await d.repos.obterConversa(conversaId);
  if (conversa.estado === 'humano') {
    await d.repos.marcarProcessadas(ids);
    return 'humano';
  }
  // Heurística: demanda aberta depois da primeira mensagem interrompida é a do turno que caiu, e então não abre Triagem.
  // Limites: uma demanda aberta por uma pessoa no painel nesse intervalo também conta (a conversa fica sem Triagem, mas
  // "esperando pessoa" e com a demanda); uma Triagem complementada pelo turno não é nova e a Triagem segue existindo.
  const desde = Math.min(...interrompidas.map((m) => Date.parse(m.criado_em)));
  const demandaDoTurno = (await d.repos.chamadosAbertosDaConversa(conversaId)).some((c) => Date.parse(c.criado_em) >= desde);
  const aviso = respondeu ? null : await d.repos.obterConfiguracoes().then((c) => c.mensagens.ia_indisponivel ?? null)
    .catch((e) => { console.error('[agente] configurações não lidas; passa à equipe sem aviso', conversaId, e); return null; });
  await encaminharParaHumano(d, conversa, 'Atendimento interrompido (reinício)', aviso, !demandaDoTurno);
  await marcarPassagem(d, conversaId, MOTIVOS_PASSAGEM.interrompido);
  await d.repos.marcarProcessadas(ids);
  return 'escalado';
}

export async function processarConversa(d: DepsProcessamento, conversaId: string, ultimaTentativa: boolean): Promise<DesfechoProcessamento> {
  try {
    return await processarConversaSemProtecao(d, conversaId, ultimaTentativa);
  } catch (e) {
    // Auditoria 4.1: ErroDepoisDoAgente relança para a fila; a nova tentativa cai na retomada (o turno agiu) e passa à
    // equipe, sem refazer o lote nem chamar a IA de novo.
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

/** Limite do dia do número (D2) ou teto do mês já atingido. */
async function passouDaVerba(d: Pick<DepsProcessamento, 'repos' | 'relogio'>, telefone: string, ehContato: boolean): Promise<boolean> {
  const config = await d.repos.obterConfiguracoes();
  if ((await d.repos.custoIaDoMes(mesReferencia(d.relogio()))) >= config.tetoIaUsd) return true;
  const limite = ehContato ? config.limiteDiaContatoUsd : config.limiteDiaDesconhecidoUsd;
  return (await d.repos.custoIaDoTelefoneHoje(telefone)) >= limite;
}

/** Erro ao marcar as mensagens depois que o agente já agiu: não vira passagem à equipe (o cliente já foi atendido). */
class ErroDepoisDoAgente extends Error {
  constructor(readonly causa: unknown) { super('falha depois do agente'); }
}

async function processarConversaSemProtecao(d: DepsProcessamento, conversaId: string, ultimaTentativa: boolean): Promise<DesfechoProcessamento> {
  // O prazo conta do começo do job (baixar mídia e transcrever também gastam o tempo do job).
  const inicio = Date.now();
  let novas = await d.repos.mensagensNaoProcessadas(conversaId);
  if (novas.length === 0) return 'sem-mensagens';
  // Auditoria 4.1: o lote ganha o turno desta vez. Mensagens de um turno que caiu depois de agir (implantação, queda) não
  // vão de novo à IA: a retomada passa à equipe. As que chegaram no meio (sem turno) seguem nesta vez.
  const turno = randomUUID();
  const lote = await d.repos.pegarLoteDoTurno(conversaId, novas.map((m) => m.id), turno);
  if (lote.interrompidas.length > 0) {
    const desfechoRetomada = await retomarInterrompida(d, conversaId, novas.filter((m) => lote.interrompidas.includes(m.id)), lote.respondeu);
    novas = novas.filter((m) => !lote.interrompidas.includes(m.id));
    if (novas.length === 0) return desfechoRetomada;
  }
  const ids = novas.map((m) => m.id);
  let conversa = await d.repos.obterConversa(conversaId);
  // Quem fala decide o custo da transcrição (revisão final, I1/I3): áudio da equipe ou de telefone interno entra só no total
  // (sem conversa, empresa nem pessoa: não é atendimento nem ação de alguém); de cliente, a conversa e a empresa da regra única.
  const usuario = await d.repos.usuarioDoAssistente(conversa.telefone);
  const interno = !usuario && (await d.repos.ehTelefoneInterno(conversa.telefone));
  const contato = usuario || interno ? null : await d.repos.buscarContato(conversa.telefone);
  const custoAudio: DestinoCusto = usuario || interno ? { conversaId: null, clienteId: null }
    : { conversaId: conversa.id, clienteId: empresaDoUso(conversa.cliente_em_foco, contato?.empresas ?? []) };
  // Revisão da Task 6: o limite do dia e o teto do mês valem antes de transcrever (a transcrição também é paga). A equipe e o
  // telefone interno não têm esse limite.
  const semVerba = !usuario && !interno && (await passouDaVerba(d, conversa.telefone, contato !== null));
  const prazoVez = inicio + PRAZO_VEZ_CONVERSA_MS;
  const anexos = await prepararMidias(d, conversa, novas, custoAudio, semVerba, prazoVez);

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

  // O texto é do dono (Configurações → Mensagens automáticas); vazio = não enviar aviso.
  await enviarAvisoLgpd(d, conversa, config.mensagens.aviso_lgpd ?? '', custoAudio.clienteId);

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
  const custoMes = await d.repos.custoIaDoMes(mes);
  if (custoMes >= config.tetoIaUsd) {
    await avisarRespostaAosPedidos(d.repos, conversa.id, ctx.contato?.id, ctx.pedidosAoContato);
    await encaminharParaHumano(d, conversa, 'Limite mensal de gasto com IA atingido', config.mensagens.ia_indisponivel ?? null);
    await marcarPassagem(d, conversa.id, MOTIVOS_PASSAGEM.teto);
    await d.repos.marcarProcessadas(ids);
    return 'teto';
  }

  // Auditoria 4.2 e 5.2 (D2): um número só não esgota mais o teto do mês de todos. O limite é lido a cada vez: o número que
  // vira contato cadastrado no meio do dia passa a ter o limite maior.
  const limiteDia = contato ? config.limiteDiaContatoUsd : config.limiteDiaDesconhecidoUsd;
  const custoTelefone = await d.repos.custoIaDoTelefoneHoje(conversa.telefone);
  if (custoTelefone >= limiteDia) {
    await avisarRespostaAosPedidos(d.repos, conversa.id, ctx.contato?.id, ctx.pedidosAoContato);
    // Sem mensagem ao cliente (D2): a equipe vê a conversa na Triagem.
    await encaminharParaHumano(d, conversa, 'Limite diário de gasto com IA deste número atingido', null);
    await marcarPassagem(d, conversa.id, MOTIVOS_PASSAGEM.limiteDia);
    await d.repos.marcarProcessadas(ids);
    await avisarLimiteDia(d, conversa.telefone);
    return 'limite';
  }

  // Revisão geral I4: resposta automática do outro lado e o agente respondendo um ao outro sem fim. Para e passa à equipe.
  const desdeVolume = new Date(Date.now() - LIMITE_VOLUME.minutos * 60_000).toISOString();
  if ((await d.repos.contarSaidasDoAgenteDesde(conversaId, desdeVolume)) >= LIMITE_VOLUME.saidas) {
    await avisarRespostaAosPedidos(d.repos, conversa.id, ctx.contato?.id, ctx.pedidosAoContato);
    await encaminharParaHumano(d, conversa, 'Muitas mensagens seguidas: possível resposta automática do cliente', null);
    await marcarPassagem(d, conversa.id, MOTIVOS_PASSAGEM.volume);
    await d.repos.marcarProcessadas(ids);
    // Sem resposta do agente, a resposta automática do outro lado para; o alerta sai uma vez por hora por conversa.
    const alerta = `O agente parou de responder ${conversa.telefone}: muitas mensagens seguidas (possível resposta automática). A conversa está na Triagem.`;
    if (!(await d.repos.alertaRecente(alerta, 60).catch(() => false))) {
      await d.alertas.alertar({ nivel: 'aviso', mensagem: alerta }).catch((e) => console.error('[volume] alerta não registrado', conversaId, e));
    }
    return 'volume';
  }

  // Auditoria 1.10: número desconhecido (reciclado pela operadora, contato arquivado) não recebe no modelo a conversa do dono
  // anterior: só os últimos 30 dias e depois da última troca de contato da conversa.
  const desconhecido = !contato || contato.empresas.length === 0;
  const desdeHistorico = desconhecido ? inicioDoHistoricoDesconhecido(conversa, d.relogio().getTime()) : undefined;
  const historico = (await d.repos.historico(conversaId, TAMANHO_HISTORICO + novas.length, desdeHistorico))
    .filter((m) => !ids.includes(m.id)).slice(-TAMANHO_HISTORICO);
  // Só as mensagens deste lote (já com transcrição): as que chegarem durante o processamento ficam para o próximo job.
  let desfecho: DesfechoProcessamento = 'agente';
  let agenteAgiu = false;
  // Revisão da Task 7: sem a trava, outra vez pode estar com a conversa. Nada de passar à equipe, avisar ou marcar: as
  // mensagens ficam com o turno desta vez, e a próxima execução retoma (se o turno agiu) ou atende (se não agiu).
  const travaPerdida = (): DesfechoProcessamento => {
    console.error('[agente] vez sem trava: para sem escrever; a próxima execução retoma o lote', conversaId);
    return 'trava-perdida';
  };
  if (d.sinalVez?.aborted) return travaPerdida();
  try {
    // Auditoria 4.11: a vez para entre as rodadas se o gasto dela passar do limite do número ou do teto do mês.
    const orcamento = { telefoneAntes: custoTelefone, limiteDia, mesAntes: custoMes, tetoMes: config.tetoIaUsd, gastoNaVez: 0 };
    const r = await atenderComAgentes({ ...d, prazoVez, orcamento, turno }, ctx, montarConteudoUsuario(ctx, historico, novas, anexos));
    agenteAgiu = true;
    if (d.sinalVez?.aborted) return travaPerdida();
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
    if (d.sinalVez?.aborted) return travaPerdida();
    try {
      if (await assumidaPorHumano(d, conversaId)) {
        desfecho = 'humano';
      } else {
        // Revisão da Task 7: o aviso "IA indisponível" nunca vem depois de uma resposta do agente neste turno. Sem saber
        // (falha ao consultar), sem aviso: a equipe recebe a conversa de qualquer jeito.
        const respondeu = await d.repos.respondeuNoTurno(conversaId, turno).catch(() => true);
        await encaminharParaHumano(d, conversa, 'Falha no agente de IA', respondeu ? null : config.mensagens.ia_indisponivel ?? null);
        await marcarPassagem(d, conversa.id, MOTIVOS_PASSAGEM.falha);
        desfecho = 'escalado';
      }
    } catch (e2) {
      // Auditoria 4.6: depois que o agente agiu, relançar refaria o lote (segunda resposta, segunda demanda). Fica escalado
      // com o registro; antes de o agente agir, o erro segue como antes (nova tentativa ou passagem na última).
      if (!agenteAgiu && (await d.repos.contarDecisoesDesde(conversaId, novas[0]!.criado_em).catch(() => 1)) === 0) throw e2;
      console.error('[agente] passagem à equipe falhou depois de o agente agir; não relança', conversaId, e2);
      // Ao menos "esperando pessoa" (melhor esforço: marcarPassagem não lança).
      await marcarPassagem(d, conversa.id, MOTIVOS_PASSAGEM.falha);
      desfecho = 'escalado';
    }
  }
  try {
    await d.repos.marcarProcessadas(ids);
  } catch (e) {
    // Auditoria 4.1: a nova tentativa que vem deste erro não refaz o lote: as mensagens têm o turno desta vez, que agiu,
    // e a retomada passa à equipe sem chamar a IA.
    throw new ErroDepoisDoAgente(e);
  }
  // O batimento confere de novo a cada poucos minutos: falha aqui não derruba a vez.
  await conferirAlertaIa80(d).catch((e) => console.error('[alerta 80%] não conferido', conversaId, e));
  return desfecho;
}

/** D2: o dono fica sabendo uma vez por dia por telefone. A chave é o hash do telefone inteiro, no banco (revisão da Task 6). */
async function avisarLimiteDia(d: Pick<DepsProcessamento, 'repos' | 'alertas'>, telefone: string): Promise<void> {
  try {
    if (!(await d.repos.marcarAvisoLimiteDia(telefone))) return;
    await d.alertas.alertar({ nivel: 'operacional', mensagem: `O número …${telefone.slice(-4)} passou do limite diário de IA e foi passado à equipe.` });
  } catch (e) {
    console.error('[limite do dia] alerta não registrado', telefone.slice(-4), e);
  }
}

/** Minutos desde o começo do mês em São Paulo (o alerta grava com o relógio do banco). */
function minutosDesdeInicioDoMesSP(agora: Date): number {
  return Math.max(1, Math.ceil((agora.getTime() - new Date(`${mesReferencia(agora)}-01T00:00:00-03:00`).getTime()) / 60_000));
}
/** Revisão da Task 6: com os canais fora, a nova tentativa espera isto. */
const ESPERA_NOVA_TENTATIVA_IA80_MS = 60 * 60_000;

/**
 * Auditoria 4.12: alerta de 80% do teto do mês. A soma é de todo o uso_ia (atendimento, especialista, transcrição, assistente,
 * sugestão, tarefas, Radar). Só quem marcou o mês envia. Roda depois de cada vez de atendimento e no batimento (tarefas.ts),
 * que cobre o gasto fora do atendimento.
 * Revisão da Task 6: se nenhum canal entregou, a marcação vira "tentativa" e a próxima só sai 1 h depois; a linha no painel
 * é gravada uma vez por mês.
 */
export async function conferirAlertaIa80(d: Pick<DepsProcessamento, 'repos' | 'alertas' | 'relogio'>): Promise<void> {
  const config = await d.repos.obterConfiguracoes();
  const agora = d.relogio();
  const mes = mesReferencia(agora);
  const marcado = config.alertaIa80Mes ?? '';
  if (marcado === mes) return;
  if (marcado.startsWith(`${PREFIXO_TENTATIVA_IA80}${mes} `)) {
    const ultima = Date.parse(marcado.slice(`${PREFIXO_TENTATIVA_IA80}${mes} `.length));
    if (Number.isFinite(ultima) && agora.getTime() - ultima < ESPERA_NOVA_TENTATIVA_IA80_MS) return;
  }
  if ((await d.repos.custoIaDoMes(mes)) < 0.8 * config.tetoIaUsd) return;
  if (!(await d.repos.marcarAlertaIa80(mes))) return;
  const mensagem = `O gasto com IA do mês passou de 80% do teto (US$ ${config.tetoIaUsd}).`;
  let entregue = false;
  try {
    const registrar = !(await d.repos.alertaRecente(mensagem, minutosDesdeInicioDoMesSP(new Date())));
    const r = await d.alertas.alertar({ nivel: 'operacional', mensagem, registrar });
    entregue = !r || r.entregue;
  } finally {
    if (!entregue) await d.repos.adiarAlertaIa80(mes, agora);
  }
}

/** Revisão geral I1: uma vez por conversa (trava no banco, a mesma chave que o batimento confere); ocupada, volta para a fila mais tarde. */
export async function processarConversaNaVez(d: DepsProcessamento, conversaId: string, ultimaTentativa: boolean) {
  return naVez(d.repos, `conversa:${conversaId}`, TRAVA_VEZ_SEGUNDOS, (sinalVez) => processarConversa({ ...d, sinalVez }, conversaId, ultimaTentativa),
    () => d.fila.enviar(FILAS.processarConversa, { conversaId }, { singletonKey: conversaId, startAfter: ESPERA_OCUPADA_SEGUNDOS }));
}
