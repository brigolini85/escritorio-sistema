import { mesReferencia } from '@escritorio/core';
import type { Conversa, Mensagem } from '@escritorio/db';
import type { Alertas } from './alertas';
import { erroTemporarioIa } from './agente/cliente-ia';
import { carregarContexto } from './agente/contexto';
import { executarAgente } from './agente/executar';
import type { DepsAgente } from './agente/ferramentas';
import { montarConteudoUsuario, type AnexoParaIa } from './agente/prompt';
import { enviarDoSistema } from './envio';
import type { ArmazenamentoMidia } from './midia/armazenamento';
import type { Transcritor } from './midia/transcritor';

export type DepsProcessamento = DepsAgente & { transcritor: Transcritor; midia: ArmazenamentoMidia; alertas: Alertas; relogio: () => Date };
export type DesfechoProcessamento = 'sem-mensagens' | 'interno' | 'humano' | 'pausado' | 'teto' | 'agente' | 'escalado';

const TAMANHO_HISTORICO = 20;
const MAX_BYTES_ANEXO = 5 * 1024 * 1024;
const IMAGENS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

async function prepararMidias(d: DepsProcessamento, conversa: Conversa, novas: Mensagem[]): Promise<AnexoParaIa[]> {
  const anexos: AnexoParaIa[] = [];
  for (const m of novas) {
    if (!m.midia_url_origem || m.arquivo_path) continue;
    const nome = m.arquivo_nome ?? (m.tipo === 'audio' ? 'audio.ogg' : m.tipo === 'imagem' ? 'imagem.jpg' : 'arquivo');
    try {
      const salvo = await d.midia.baixarESalvar(m.midia_url_origem, conversa.id, nome, m.arquivo_mime);
      const patch: Partial<Mensagem> = { arquivo_path: salvo.path, arquivo_mime: salvo.mime };
      if (m.tipo === 'audio') {
        patch.transcricao = await d.transcritor.transcrever(salvo.bytes, salvo.mime.split(';')[0]!, nome)
          .catch(() => '[áudio não pôde ser transcrito]');
        m.transcricao = patch.transcricao;
      } else if (salvo.bytes.length <= MAX_BYTES_ANEXO) {
        const base64 = Buffer.from(salvo.bytes).toString('base64');
        const mime = salvo.mime.split(';')[0]!;
        if (m.tipo === 'imagem' && IMAGENS.includes(mime)) anexos.push({ tipo: 'imagem', mime, base64, nome });
        if (m.tipo === 'documento' && mime === 'application/pdf') anexos.push({ tipo: 'documento', mime, base64, nome });
      }
      await d.repos.atualizarMensagem(m.id, patch);
    } catch (e) {
      console.error('[mídia] falha ao preparar', m.id, e);
      await d.repos.atualizarMensagem(m.id, { conteudo: `${m.conteudo ?? ''} [anexo não pôde ser baixado]`.trim() });
    }
  }
  return anexos;
}

async function encaminharParaHumano(d: DepsProcessamento, conversa: Conversa, motivo: string, textoCliente: string | null): Promise<void> {
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

export async function processarConversa(d: DepsProcessamento, conversaId: string, ultimaTentativa: boolean): Promise<DesfechoProcessamento> {
  const novas = await d.repos.mensagensNaoProcessadas(conversaId);
  if (novas.length === 0) return 'sem-mensagens';
  const ids = novas.map((m) => m.id);
  let conversa = await d.repos.obterConversa(conversaId);
  const anexos = await prepararMidias(d, conversa, novas);

  if (await d.repos.ehTelefoneInterno(conversa.telefone)) {
    await d.repos.marcarProcessadas(ids);
    return 'interno';
  }
  if (conversa.estado === 'humano') {
    await d.repos.marcarProcessadas(ids);
    return 'humano';
  }

  const config = await d.repos.obterConfiguracoes();
  const contato = await d.repos.buscarContato(conversa.telefone);

  if (!conversa.aviso_lgpd_enviado_em) {
    await enviarDoSistema(d.envio, { conversaId, telefone: conversa.telefone, clienteId: conversa.cliente_em_foco, autor: 'sistema', texto: config.mensagens.aviso_lgpd ?? '' });
    await d.repos.atualizarConversa(conversaId, { aviso_lgpd_enviado_em: d.relogio().toISOString() });
  }

  const ctx = await carregarContexto(d.repos, conversa, contato, config, d.relogio());
  conversa = ctx.conversa = await d.repos.obterConversa(conversaId);

  const empresas = contato?.empresas ?? [];
  const pausado = config.agentePausado || ctx.empresaEmFoco?.agentePausado === true
    || (empresas.length > 0 && empresas.every((e) => e.agentePausado));
  if (pausado) {
    await encaminharParaHumano(d, conversa, 'Agente pausado: atender manualmente', config.mensagens.agente_pausado ?? null);
    await d.repos.marcarProcessadas(ids);
    return 'pausado';
  }

  const mes = mesReferencia(d.relogio());
  if ((await d.repos.custoIaDoMes(mes)) >= config.tetoIaUsd) {
    await encaminharParaHumano(d, conversa, 'Limite mensal de gasto com IA atingido', config.mensagens.ia_indisponivel ?? null);
    await d.repos.marcarProcessadas(ids);
    return 'teto';
  }

  const historico = (await d.repos.historico(conversaId, TAMANHO_HISTORICO + novas.length)).filter((m) => !ids.includes(m.id)).slice(-TAMANHO_HISTORICO);
  // Só as mensagens deste lote (já com transcrição): as que chegarem durante o processamento ficam para o próximo job.
  let desfecho: DesfechoProcessamento = 'agente';
  let agenteAgiu = false;
  try {
    const r = await executarAgente(d, ctx, montarConteudoUsuario(ctx, historico, novas, anexos));
    agenteAgiu = true;
    if (r.status === 'escalar') {
      if (await assumidaPorHumano(d, conversaId)) {
        desfecho = 'humano';
      } else {
        const respondeu = (await d.repos.historico(conversaId, 3)).some((m) => m.autor === 'agente' && m.direcao === 'saida' && !ids.includes(m.id));
        await encaminharParaHumano(d, conversa, `Agente encaminhou: ${r.motivo}`, respondeu ? null : config.mensagens.ia_indisponivel ?? null);
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
      desfecho = 'escalado';
    }
  }
  await d.repos.marcarProcessadas(ids);

  if (config.alertaIa80Mes !== mes && (await d.repos.custoIaDoMes(mes)) >= 0.8 * config.tetoIaUsd) {
    await d.alertas.alertar({ nivel: 'operacional', mensagem: `O gasto com IA do mês passou de 80% do teto (US$ ${config.tetoIaUsd}).` });
    await d.repos.marcarAlertaIa80(mes);
  }
  return desfecho;
}
