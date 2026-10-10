import { createHash, timingSafeEqual } from 'node:crypto';
import type { Writable } from 'node:stream';
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { empresaDoUso, telefoneDoWhatsApp } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import type { CanalWhatsApp } from './canal/tipos';
import { FILAS, agendarProcessamento, type Fila } from './fila';

export type DepsServidor = {
  canal: CanalWhatsApp; repos: Repos; fila: Fila; segredo: string; relogio: () => Date;
  /** Prontidão (D3): com ele, /saude mostra os detalhes. */
  saudeToken?: string;
  /** Prontidão (D2): aparece nos detalhes do /saude (produção sem AMBIENTE=producao não passa despercebida). */
  ambiente?: string;
  /** Auditoria 6.8: versão e data do build (lerBuild); com o token, aparecem no /saude para a publicação conferir o trabalhador novo. */
  build?: { versao: string; buildEm: string | null };
  /** Auditoria 3.1: instância da Z-API; evento de outra instância (ou sem instanceId) é descartado. Sem ela, não confere (testes antigos). */
  instancia?: string;
  /** Auditoria 3.1: requisições por minuto e por IP. */
  limites?: { webhook: number; saude: number };
  /**
   * Auditoria 4.3: o que só o processo sabe (AMBIENTE diferente do banco, outra instância viva). Cada falha entra no /saude;
   * `instancias` (os hostnames das outras) aparece nos detalhes.
   */
  situacaoProcesso?: () => { falhas: FalhaProcesso[]; instancias: string[] };
  /**
   * Auditoria 4.3 (revisão): falso quando o AMBIENTE do processo não é o do banco. O webhook responde 503 (a Z-API entrega
   * de novo mais tarde, ao trabalhador certo) e não grava nada. Sem ele, aberto.
   */
  webhookAberto?: () => boolean;
  /** Só para testes: onde o log é escrito. */
  logStream?: Writable;
};

const LIMITES_PADRAO = { webhook: 120, saude: 30 } as const;
const JANELA_LIMITE_MS = 60_000;
/** Auditoria 3.7: mais de 20 descartes por esquema em 10 min viram alerta (no máximo um por hora). */
const DESCARTES_PARA_ALERTA = 20;
const JANELA_DESCARTES_MS = 10 * 60_000;

/** Auditoria 3.4: o segredo (e o token do /saude) nunca vão para o log, em qualquer forma de URL. */
export function mascararUrl(url: string): string {
  return url.replace(/\/(webhook|zapi)\/[^?#]*/g, '/$1/***').replace(/([?&]token=)[^&#]*/g, '$1***');
}

/**
 * Auditoria 4.9: `iaMs`, quanto tempo o sinal ia_falha deixa o /saude em falha; `enviosComFalha`, acima disto na última hora é
 * falha (uma ou outra saída incerta é normal). Mensagem de cliente atrasada (mais de 5 min, conta no banco) já é falha.
 */
export const LIMITES_SAUDE = { sinalMs: 3 * 60_000, iaMs: 15 * 60_000, enviosComFalha: 5 } as const;

export type FalhaProcesso = 'ambiente' | 'instancias' | 'parado';
type Falha = 'banco' | 'batimento' | 'whatsapp' | 'ia' | 'conversas_atrasadas' | 'envios_com_falha' | FalhaProcesso;
/** Prontidão (D3): o que o monitor externo precisa saber. Sem segredo na resposta (só contagens). */
export async function avaliarSaude(repos: Pick<Repos, 'sinaisVida' | 'indicadoresSaude'>, agora: Date) {
  let sinais: Record<string, Date>;
  let ind: Awaited<ReturnType<Repos['indicadoresSaude']>>;
  try {
    [sinais, ind] = await Promise.all([repos.sinaisVida(), repos.indicadoresSaude()]);
  } catch {
    return { ok: false, falhas: ['banco'] as Falha[], sinais: {} as Record<string, string> };
  }
  const idade = (c: string) => (sinais[c] ? agora.getTime() - sinais[c].getTime() : Number.POSITIVE_INFINITY);
  const falhas: Falha[] = [];
  if (idade('fila') >= LIMITES_SAUDE.sinalMs) falhas.push('batimento');
  if (idade('whatsapp') >= LIMITES_SAUDE.sinalMs) falhas.push('whatsapp');
  // Auditoria 4.8 e 4.9: a IA, as conversas de cliente sem resposta e os envios que não saíram.
  if (idade('ia_falha') < LIMITES_SAUDE.iaMs) falhas.push('ia');
  if (ind.conversasAtrasadas > 0) falhas.push('conversas_atrasadas');
  if (ind.enviosComFalha > LIMITES_SAUDE.enviosComFalha) falhas.push('envios_com_falha');
  return {
    ok: falhas.length === 0, falhas, sinais: Object.fromEntries(Object.entries(sinais).map(([k, v]) => [k, v.toISOString()])),
    indicadores: { conversas_atrasadas: ind.conversasAtrasadas, envios_com_falha: ind.enviosComFalha },
  };
}

function segredoConfere(recebido: string, esperado: string): boolean {
  // Compara os resumos (mesmo tamanho sempre): o tempo não revela nem o conteúdo nem o comprimento do segredo.
  const a = createHash('sha256').update(recebido).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

export function criarServidor(d: DepsServidor): FastifyInstance {
  const app = Fastify({
    bodyLimit: 1_000_000,
    logger: {
      level: 'info',
      // O segredo do webhook faz parte da URL: nunca vai para o log, nem em rota desconhecida (3.4).
      // O token do /saude (?token=) também não.
      serializers: { req: (req) => ({ method: req.method, url: mascararUrl(req.url) }) },
      ...(d.logStream ? { stream: d.logStream } : {}),
    },
    // Atrás do proxy do Easypanel, o IP de verdade vem no X-Forwarded-For (senão todos dividiriam o mesmo limite).
    trustProxy: true,
    // Segredo comprido demais (maxParamLength) ou URL malformada: o padrão devolve o caminho na resposta.
    frameworkErrors: (err: FastifyError, req: FastifyRequest, rep: FastifyReply) => {
      req.log.warn({ codigo: err.code }, 'url_recusada');
      return rep.code(err.statusCode ?? 400).send({ erro: 'requisição inválida' });
    },
  });

  // Auditoria 3.4: 404 e 500 próprios, sem eco da URL na resposta nem no log (o padrão do Fastify loga a URL crua).
  app.setNotFoundHandler((_req, rep) => rep.code(404).send({ erro: 'não encontrado' }));
  app.setErrorHandler((err: FastifyError, req, rep) => {
    const status = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    req.log.error({ err, status, url: mascararUrl(req.url) }, 'erro na requisição');
    return rep.code(status).send({ erro: status === 500 ? 'erro interno' : 'requisição inválida' });
  });

  // Auditoria 3.1: limite por IP, em memória (há um processo só). Vem antes da conferência do segredo, para frear tentativas de adivinhar.
  const limites = d.limites ?? LIMITES_PADRAO;
  const contagens = { webhook: new Map<string, number>(), saude: new Map<string, number>() };
  let inicioJanela = d.relogio().getTime();
  app.addHook('onRequest', async (req, rep) => {
    const caminho = req.url.split('?')[0]!;
    const balde = caminho.startsWith('/webhook/') ? 'webhook' : caminho === '/saude' ? 'saude' : null;
    if (!balde) return;
    const agora = d.relogio().getTime();
    if (agora - inicioJanela >= JANELA_LIMITE_MS) { contagens.webhook.clear(); contagens.saude.clear(); inicioJanela = agora; }
    const n = (contagens[balde].get(req.ip) ?? 0) + 1;
    contagens[balde].set(req.ip, n);
    if (n > limites[balde]) {
      if (n === limites[balde] + 1) req.log.warn({ balde, ip: req.ip }, 'limite_de_requisicoes');
      return rep.code(429).send({ erro: 'muitas requisições' });
    }
  });

  let webhookRecusadoLogado = false;
  const descartes: number[] = [];
  async function contarDescarte(req: { log: FastifyInstance['log'] }) {
    const agora = d.relogio().getTime();
    descartes.push(agora);
    while (descartes.length > 0 && agora - descartes[0]! > JANELA_DESCARTES_MS) descartes.shift();
    if (descartes.length <= DESCARTES_PARA_ALERTA) return;
    const aviso = 'Muitas mensagens do WhatsApp chegaram em formato que o sistema não entende e foram descartadas. Confira se a Z-API mudou o formato do aviso.';
    try {
      if (!(await d.repos.alertaRecente(aviso, 60))) await d.repos.registrarAlerta({ nivel: 'aviso', mensagem: aviso });
    } catch (e) {
      req.log.error(e, 'alerta de descartes não registrado');
    }
  }

  app.post<{ Params: { segredo: string } }>('/webhook/zapi/:segredo', async (req, rep) => {
    if (!segredoConfere(req.params.segredo, d.segredo)) return rep.code(401).send();
    if (d.webhookAberto && !d.webhookAberto()) {
      if (!webhookRecusadoLogado) {
        webhookRecusadoLogado = true;
        req.log.error('webhook_recusado_ambiente: o AMBIENTE deste trabalhador não é o do banco; nada é gravado');
      }
      return rep.code(503).send({ erro: 'indisponível' });
    }
    const m = d.canal.interpretarWebhook(req.body);
    if (!m) {
      // Auditoria 3.7: o descarte deixa rastro (só o type, nunca o conteúdo). Aviso/reação são esperados e não contam.
      const c = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const type = typeof c.type === 'string' ? c.type.slice(0, 40) : null;
      // Status, lista de transmissão e canal (3.7, resto) também são esperados.
      const motivo = c.notification || c.reaction ? 'aviso_ou_reacao'
        : c.broadcast === true || c.isNewsletter === true || c.isStatusReply === true ? 'status_ou_canal' : 'esquema';
      const esperado = motivo !== 'esquema';
      req.log.info({ type, motivo }, 'webhook_descartado');
      if (!esperado) await contarDescarte(req);
      return { ok: true };
    }
    // Auditoria 3.7 (revisão): a edição segue como mensagem nova (prefixo e id próprios); o motivo fica no log.
    if ((req.body as { isEdit?: unknown } | null)?.isEdit === true) req.log.info({ motivo: 'edicao' }, 'webhook_edicao');
    // Auditoria 3.1: evento de outra instância, ou sem instanceId (as capturas reais sempre trazem), não vira nada.
    const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
    if (d.instancia && (!m.instanciaId || norm(m.instanciaId) !== norm(d.instancia))) {
      req.log.warn({ recebida: m.instanciaId ? String(m.instanciaId).slice(0, 40) : null }, 'instancia_diferente');
      // Se ZAPI_INSTANCIA estiver errada, todas as mensagens somem: o dono precisa ficar sabendo (no máximo 1 por hora).
      const aviso = 'O WhatsApp está recebendo mensagens de uma instância diferente da configurada (ZAPI_INSTANCIA). Nenhuma mensagem está sendo atendida: confira se ZAPI_INSTANCIA é igual ao id da instância na Z-API.';
      try {
        if (!(await d.repos.alertaRecente(aviso, 60))) await d.repos.registrarAlerta({ nivel: 'critico', mensagem: aviso });
      } catch (e) {
        req.log.error(e, 'alerta de instância diferente não registrado');
      }
      return { ok: true };
    }
    if (m.ehGrupo) return { ok: true };

    if (m.enviadaPorMim) {
      // Espera o envio do próprio sistema gravar o id antes de decidir se foi uma pessoa no celular.
      await d.fila.enviar(FILAS.verificarEnviadaPorMim, m, { startAfter: 5 });
      return { ok: true };
    }

    const telefone = telefoneDoWhatsApp(m.telefone);
    if (!telefone) {
      // Revisão geral I7: número estrangeiro ou identificador "@lid" não vira conversa (o agente e o envio são só para o Brasil),
      // mas a equipe fica sabendo (uma vez por hora por número) para responder pelo celular do escritório.
      const bruto = m.telefone.slice(0, 60);
      // Auditoria 3.4: o número não vai bruto para o log (dado pessoal); só o final.
      req.log.warn({ telefoneFinal: bruto.slice(-4) }, 'mensagem de número fora do formato brasileiro');
      const aviso = `Mensagem de WhatsApp de um número fora do padrão brasileiro (${bruto}) não foi atendida pelo agente. Responda pelo celular do escritório.`;
      try {
        if (!(await d.repos.alertaRecente(aviso, 60))) await d.repos.registrarAlerta({ nivel: 'aviso', mensagem: aviso });
      } catch (e) {
        req.log.error(e, 'alerta do número fora do padrão não registrado');
      }
      return { ok: true };
    }

    const contato = await d.repos.buscarContato(telefone);
    const conversa = await d.repos.obterOuCriarConversa(telefone, contato?.id ?? null);
    const { duplicada } = await d.repos.inserirMensagemEntrada({
      conversaId: conversa.id,
      // Auditoria 1.4 e 3.9: o foco gravado só vale se a empresa ainda é do contato.
      clienteId: empresaDoUso(conversa.cliente_em_foco, contato?.empresas ?? []),
      idProvedor: m.idProvedor,
      tipo: m.tipo === 'outro' ? 'texto' : m.tipo,
      conteudo: m.tipo === 'outro' ? '[mensagem de tipo não suportado]' : m.texto,
      midiaUrlOrigem: m.midia?.url ?? null,
      arquivoNome: m.midia?.nomeArquivo ?? null,
      arquivoMime: m.midia?.mime ?? null,
    });
    if (!duplicada) await agendarProcessamento(d.fila, conversa.id);
    return { ok: true };
  });

  app.get<{ Querystring: { token?: string } }>('/saude', async (req, rep) => {
    const base = await avaliarSaude(d.repos, d.relogio());
    const p = d.situacaoProcesso?.() ?? { falhas: [], instancias: [] };
    const falhas = [...base.falhas, ...p.falhas];
    const s = { ...base, ok: falhas.length === 0, falhas, ...(d.situacaoProcesso ? { instancias: p.instancias } : {}) };
    const cabecalho = req.headers['x-saude-token'];
    const dado = (typeof cabecalho === 'string' ? cabecalho : undefined) ?? req.query.token ?? '';
    // Sem token (ou errado): só o ok, para o monitor público; nada de 401 (o monitor sem token continua funcionando).
    const detalhes = Boolean(d.saudeToken) && segredoConfere(dado, d.saudeToken!);
    return rep.code(s.ok ? 200 : 503).send(detalhes
      ? { ...s, ambiente: d.ambiente ?? null, ...(d.build ? { versao: d.build.versao, build_em: d.build.buildEm } : {}) }
      : { ok: s.ok });
  });
  // D3: o HEALTHCHECK do contêiner; só diz que o processo responde (WhatsApp ou banco fora não reiniciam o trabalhador em laço).
  app.get('/vivo', async () => ({ ok: true }));

  return app;
}
