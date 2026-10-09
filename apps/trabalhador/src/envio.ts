import { caminhoDaEmpresa, empresaDoUso, telefoneDoWhatsApp } from '@escritorio/core';
import type { DocumentoEmpresa, Repos } from '@escritorio/db';
import { EnvioIncerto, type CanalWhatsApp, type MensagemRecebida } from './canal/tipos';
import { FILAS, type Fila } from './fila';
import type { ArmazenamentoMidia } from './midia/armazenamento';

/**
 * Auditoria 3.11: o limite de avisos do sistema por minuto. A contagem fica no banco (reservar_envio_sistema), para valer
 * entre processos; sem vaga, o aviso vai para a fila de envio e a vez da conversa não espera.
 */
export class LimitadorEnvio {
  constructor(readonly maxPorMinuto: number) {}
}

/** Sem vaga no minuto: o aviso sai pela fila de envio depois disto. */
export const ESPERA_SEM_VAGA_SEGUNDOS = 60;

/** `fila`: para onde vão os avisos do sistema sem vaga no minuto. Sem ela (testes, cenários), o aviso sai na hora. */
export type DepsEnvio = { repos: Repos; canal: CanalWhatsApp; limitador: LimitadorEnvio; midia: ArmazenamentoMidia; fila?: Fila };

async function temVaga(d: DepsEnvio): Promise<boolean> {
  try {
    return await d.repos.reservarVagaEnvioSistema(d.limitador.maxPorMinuto);
  } catch (e) {
    // O limite protege a Z-API de rajadas; sem conseguir contar, o aviso sai (melhor que sumir).
    console.error('[envio] limite de avisos não consultado; envia assim mesmo', e);
    return true;
  }
}

async function adiarAviso(d: DepsEnvio, id: string): Promise<boolean> {
  if (!d.fila) return false;
  await d.fila.enviar(FILAS.enviarMensagem, { mensagemId: id }, { startAfter: ESPERA_SEM_VAGA_SEGUNDOS });
  return true;
}

/**
 * Auditoria 3.2: envia e grava o resultado. Incerto (a requisição saiu e não se sabe se entregou): "incerto", sem erro, e o
 * eco confirma; quem chamou segue como se tivesse saído (não manda "IA indisponível", não reenvia). Falha certa (4xx,
 * conexão recusada): "falhou" e o erro segue. A gravação de "enviada" que falha deixa "incerto" (a mensagem saiu).
 */
async function enviarERegistrar(d: DepsEnvio, id: string, enviar: () => Promise<{ idProvedor: string }>): Promise<void> {
  let idProvedor: string;
  try {
    ({ idProvedor } = await enviar());
  } catch (e) {
    if (e instanceof EnvioIncerto) {
      console.warn(`[envio] resultado incerto na mensagem ${id}; o eco confirma`, e.message);
      await d.repos.marcarIncerto(id);
      return;
    }
    await d.repos.marcarFalha(id);
    throw e;
  }
  try {
    await d.repos.marcarEnviada(id, idProvedor);
  } catch (e) {
    await d.repos.marcarIncerto(id).catch((e2) => console.error('[envio] nem "incerto" foi gravado', id, e2));
    throw e;
  }
}

/**
 * Grava a mensagem como pendente ANTES de enviar, para reconhecer o eco "enviada por mim".
 * O limite vale só para mensagens de autor "sistema" (avisos, alertas, resumo) — respostas do agente não esperam.
 */
export async function enviarDoSistema(
  d: DepsEnvio,
  p: {
    conversaId: string; telefone: string; clienteId: string | null; autor: 'agente' | 'sistema'; texto: string; turnoAgente?: string | null;
    /** Revisão da Task 9: fora do limite de avisos (o aviso de privacidade, um por conversa, sai antes da resposta). */
    semLimite?: boolean;
  },
): Promise<string> {
  const id = await d.repos.criarSaidaPendente({ conversaId: p.conversaId, clienteId: p.clienteId, autor: p.autor, conteudo: p.texto, turnoAgente: p.turnoAgente ?? null });
  if (p.autor === 'sistema' && !p.semLimite && !(await temVaga(d))) {
    try {
      if (await adiarAviso(d, id)) return id;
    } catch (e) {
      await d.repos.marcarFalha(id);
      throw e;
    }
  }
  await enviarERegistrar(d, id, () => d.canal.enviarTexto(p.telefone, p.texto));
  return id;
}

/**
 * Conteúdo do arquivo embutido (data URI em Base64), aceito pela Z-API no lugar do link.
 * Com link, quem baixa é a Z-API: um endereço que ela não alcança (ex.: Supabase local) falha sem aviso.
 */
async function arquivoEmBase64(d: DepsEnvio, path: string, mime: string, bucket?: string): Promise<string> {
  const bytes = await d.midia.ler(path, bucket);
  return `data:${mime.split(';')[0]};base64,${Buffer.from(bytes).toString('base64')}`;
}

/** Auditoria 6.9: acima disto o documento não vai pelo WhatsApp (bytes + Base64 + JSON da Z-API ao mesmo tempo na memória). */
export const LIMITE_DOCUMENTO_BYTES = 15 * 1024 * 1024;

/** Auditoria 6.9: o texto vai ao agente como está (a ferramenta devolve a mensagem). */
export class DocumentoGrandeDemais extends Error {
  constructor() { super('documento grande demais para o WhatsApp; abra uma demanda'); }
}

/** Documento da empresa (bucket "documentos"): registra antes, como em enviarDoSistema, e envia o conteúdo. */
export async function enviarDocumentoDoSistema(
  d: DepsEnvio,
  p: { conversaId: string; telefone: string; clienteId: string; documento: DocumentoEmpresa; turnoAgente?: string | null },
): Promise<string> {
  // Auditoria 1.3: a chave de serviço lê qualquer arquivo; o de outra empresa não é lido nem enviado.
  if (!caminhoDaEmpresa(p.clienteId, p.documento.arquivoPath)) {
    console.error(`[envio] documento ${p.documento.id} recusado: arquivo fora da pasta da empresa`);
    throw new Error('Documento recusado: o arquivo não está na pasta da empresa.');
  }
  // Auditoria 6.9: grande demais não é lido (o tamanho vem do Storage, sem baixar).
  const tamanho = await d.midia.tamanho(p.documento.arquivoPath, 'documentos').catch(() => null);
  if (tamanho !== null && tamanho > LIMITE_DOCUMENTO_BYTES) throw new DocumentoGrandeDemais();
  // Sem o tamanho do Storage: lê antes de criar a mensagem, para o grande não deixar um "📎" falhou na conversa (revisão).
  // A leitura que falha aqui é repetida abaixo e marca a mensagem como antes.
  let bytes = tamanho === null ? await d.midia.ler(p.documento.arquivoPath, 'documentos').catch(() => null) : null;
  if (bytes && bytes.length > LIMITE_DOCUMENTO_BYTES) throw new DocumentoGrandeDemais();
  // O painel mostra o documento com link (download auditado pelo id), não só o nome.
  const id = await d.repos.criarSaidaPendente({ conversaId: p.conversaId, clienteId: p.clienteId, autor: 'agente', conteudo: `📎 ${p.documento.nome}`,
    turnoAgente: p.turnoAgente ?? null, documentoId: p.documento.id });
  let url: string;
  try {
    bytes ??= await d.midia.ler(p.documento.arquivoPath, 'documentos');
    // Segunda conferência antes de montar o Base64 (o arquivo pode ter mudado depois do tamanho lido).
    if (bytes.length > LIMITE_DOCUMENTO_BYTES) throw new DocumentoGrandeDemais();
    url = `data:${p.documento.arquivoMime.split(';')[0]};base64,${Buffer.from(bytes).toString('base64')}`;
  } catch (e) {
    await d.repos.marcarFalha(id);
    throw e;
  }
  await enviarERegistrar(d, id, () => d.canal.enviarArquivo(p.telefone, { url, nome: p.documento.arquivoNome }));
  return id;
}

const CAMINHO_DE_ANEXO = /^conversas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+$/;

/**
 * Job enviar-mensagem: resposta do painel ("pendente" ou "falhou" numa nova tentativa) ou aviso do sistema adiado pelo
 * limite (auditoria 3.11). A mensagem só fica "falhou" de vez na última tentativa da fila.
 * Auditoria 3.3: resultado incerto não relança (a nova tentativa mandaria de novo): fica "incerto" e a tela mostra
 * "Não confirmada" com "Enviar de novo". Texto e arquivo: o texto sai primeiro e vira mensagem própria numa transação,
 * e só então o arquivo; a reserva (envio_reservado_em) é por mensagem.
 */
export async function enviarMensagemDoPainel(d: DepsEnvio, mensagemId: string, ultimaTentativa = true): Promise<void> {
  const m = await d.repos.obterMensagem(mensagemId);
  const doPainel = m.autor === 'atendente' && (m.status_envio === 'pendente' || m.status_envio === 'falhou');
  const avisoAdiado = m.autor === 'sistema' && m.direcao === 'saida' && m.status_envio === 'pendente' && !m.arquivo_path;
  if (!doPainel && !avisoAdiado) return;
  // Ainda sem vaga no minuto: volta para a fila (sem reservar).
  if (avisoAdiado && !(await temVaga(d)) && (await adiarAviso(d, m.id))) return;
  // Outra tarefa da fila já está enviando esta resposta: não manda de novo.
  if (!(await d.repos.reservarEnvio(m.id))) return;
  // Revisão geral I1: a chave de serviço lê qualquer arquivo; só anexo de conversa sai daqui (o banco já confere quem pediu).
  if (m.arquivo_path && !CAMINHO_DE_ANEXO.test(m.arquivo_path)) {
    console.error(`[envio] caminho de arquivo recusado na mensagem ${m.id}`);
    await d.repos.marcarFalha(m.id);
    await d.repos.liberarEnvio(m.id);
    return;
  }
  const conversa = await d.repos.obterConversa(m.conversa_id);
  let idProvedor: string | null = null;
  try {
    if (m.conteudo && m.arquivo_path) {
      // O texto vira mensagem própria (enviada com o id, ou incerta sem id); a nova tentativa não o repete.
      // Se a separação falhar depois de o texto sair, o eco do texto separa sozinho (casar_eco_saida) antes da nova tentativa.
      let separado: { id: string | null; status: 'enviada' | 'incerto' };
      try {
        separado = { id: (await d.canal.enviarTexto(conversa.telefone, m.conteudo)).idProvedor, status: 'enviada' };
      } catch (e) {
        if (!(e instanceof EnvioIncerto)) throw e;
        console.warn(`[envio] texto da resposta ${m.id} com resultado incerto; o arquivo segue`, e.message);
        separado = { id: null, status: 'incerto' };
      }
      try {
        await d.repos.separarTextoEnviado(m.id, separado.id, separado.status);
      } catch (e) {
        // Revisão da Task 9: o texto já saiu; relançar faria a nova tentativa mandar o texto de novo. Fica "incerto" com a
        // reserva: o eco do texto ainda separa sozinho, e a pessoa vê "Não confirmada" e decide sobre o arquivo.
        console.error(`[envio] texto da resposta ${m.id} saiu, mas a separação falhou; fica incerta`, e);
        await d.repos.marcarIncerto(m.id);
        return;
      }
    }
    if (m.arquivo_path) {
      const url = await arquivoEmBase64(d, m.arquivo_path, m.arquivo_mime ?? 'application/pdf');
      idProvedor = (await d.canal.enviarArquivo(conversa.telefone, { url, nome: m.arquivo_nome ?? 'arquivo.pdf' })).idProvedor;
    } else if (m.conteudo) {
      idProvedor = (await d.canal.enviarTexto(conversa.telefone, m.conteudo)).idProvedor;
    }
  } catch (e) {
    if (e instanceof EnvioIncerto) {
      // A reserva fica: é o momento do envio (a janela do eco) e impede outra tarefa de pegar a mensagem.
      console.warn(`[envio] resposta ${m.id} com resultado incerto; não reenvia sozinha`, e.message);
      await d.repos.marcarIncerto(m.id);
      return;
    }
    if (ultimaTentativa) await d.repos.marcarFalha(m.id);
    await d.repos.liberarEnvio(m.id);
    throw e;
  }
  try {
    await d.repos.marcarEnviada(m.id, idProvedor ?? `sem-id-${m.id}`);
  } catch (e) {
    // A mensagem saiu: nunca volta a "pendente" livre (a reserva fica e "incerto" impede o reenvio).
    await d.repos.marcarIncerto(m.id).catch((e2) => console.error('[envio] nem "incerto" foi gravado', m.id, e2));
    throw e;
  }
}

/** Revisão geral I3: quantas vezes a verificação do eco espera (30 s cada) um envio do sistema que ainda não gravou o id. */
export const ESPERAS_ECO = 6;

/** Job da fila verificar-enviada-por-mim: o eco e quantas vezes já esperou. */
export async function tratarEnviadaPorMim(d: DepsEnvio, fila: Fila, m: MensagemRecebida & { esperas?: number }): Promise<'do-sistema' | 'humano' | 'aguardar'> {
  const esperas = m.esperas ?? 0;
  const r = await verificarEnviadaPorMim(d, m, esperas < ESPERAS_ECO);
  if (r === 'aguardar') await fila.enviar(FILAS.verificarEnviadaPorMim, { ...m, esperas: esperas + 1 }, { startAfter: 30 });
  return r;
}

/**
 * `podeEsperar` (revisão geral I3): sem id nem texto que case, mas com envio do sistema da conversa ainda pendente, devolve
 * "aguardar" em vez de concluir que foi uma pessoa no celular (eco de arquivo grande chega antes de o envio gravar o id).
 * Auditoria 3.2: o eco casa também com a saída "incerto" (texto com espaços normalizados ou nome do arquivo, 10 min).
 */
export async function verificarEnviadaPorMim(d: DepsEnvio, m: MensagemRecebida, podeEsperar = false): Promise<'do-sistema' | 'humano' | 'aguardar'> {
  if (await d.repos.mensagemPorIdProvedor(m.idProvedor)) return 'do-sistema';
  // Auditoria 3.10: o mesmo critério da entrada; número estrangeiro ou "@lid" não vira conversa fantasma "55…".
  const telefone = telefoneDoWhatsApp(m.telefone);
  if (!telefone) return 'do-sistema';
  // Resposta do assistente interno: não tem linha em `mensagens` e nunca assume a conversa como atendimento humano.
  if (await d.repos.usuarioDoAssistente(telefone)) return 'do-sistema';
  const conversa = await d.repos.obterOuCriarConversa(telefone, null);
  // Revisão da Task 9: eco de arquivo casa pelo nome (sem extensão nem maiúsculas) ou, sem nome que case, com o arquivo
  // mais antigo da conversa (imagem chega sem nome).
  const ehArquivo = m.tipo !== 'texto';
  const arquivoNome = ehArquivo ? m.midia?.nomeArquivo ?? null : null;
  if (await d.repos.casarEcoSaida(conversa.id, m.texto, arquivoNome, m.idProvedor, ehArquivo)) return 'do-sistema';
  // Só eco sem texto (arquivo): o sistema e o painel mandam arquivo sem legenda; texto digitado no celular não espera.
  if (podeEsperar && m.tipo !== 'texto' && (await d.repos.temSaidaPendenteRecente(conversa.id, 10))) return 'aguardar';
  // Auditoria 1.4: o foco gravado só vale se a empresa ainda é do contato.
  const contato = await d.repos.buscarContato(telefone);
  await d.repos.inserirSaidaExterna({
    conversaId: conversa.id, clienteId: empresaDoUso(conversa.cliente_em_foco, contato?.empresas ?? []), idProvedor: m.idProvedor, conteudo: m.texto,
  });
  // Como assumir pelo painel: limpa a espera e grava o marco "assumida" (sem pessoa: o celular não diz quem respondeu).
  if (await d.repos.assumirPeloCelular(conversa.id)) await alertarRespostaPeloCelular(d, conversa.id, telefone);
  return 'humano';
}

/**
 * Auditoria 3.6: a equipe precisa saber que o agente parou nesta conversa (pode ter sido engano). Uma vez por hora por
 * conversa; só os 4 últimos dígitos do telefone. Falha ao registrar não muda o resultado.
 */
async function alertarRespostaPeloCelular(d: DepsEnvio, conversaId: string, telefone: string): Promise<void> {
  const mensagem = `Alguém respondeu pelo celular a …${telefone.slice(-4)}; o agente parou nessa conversa.`;
  try {
    // Revisão da Task 9: a chave é a conversa e a hora (UTC), no banco: duas conversas com o mesmo final avisam as duas,
    // e dois processos ao mesmo tempo avisam uma vez.
    const hora = new Date().toISOString().slice(0, 13);
    if (await d.repos.marcarAvisoUnico(`celular:${conversaId}:${hora}`)) await d.repos.registrarAlerta({ nivel: 'aviso', mensagem });
  } catch (e) {
    console.error('[eco] alerta da resposta pelo celular não registrado', telefone.slice(-4), e);
  }
}
