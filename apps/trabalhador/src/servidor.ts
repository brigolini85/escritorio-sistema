import { createHash, timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { telefoneDoWhatsApp } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import type { CanalWhatsApp } from './canal/tipos';
import { FILAS, agendarProcessamento, type Fila } from './fila';

export type DepsServidor = {
  canal: CanalWhatsApp; repos: Repos; fila: Fila; segredo: string; relogio: () => Date;
  /** Prontidão (D3): com ele, /saude mostra os detalhes. */
  saudeToken?: string;
  /** Prontidão (D2): aparece nos detalhes do /saude (produção sem AMBIENTE=producao não passa despercebida). */
  ambiente?: string;
};

export const LIMITES_SAUDE = { sinalMs: 3 * 60_000 } as const;

type Falha = 'banco' | 'batimento' | 'whatsapp';
/** Prontidão (D3): o que o monitor externo precisa saber. Sem segredo na resposta. */
export async function avaliarSaude(repos: Pick<Repos, 'sinaisVida'>, agora: Date) {
  let sinais: Record<string, Date>;
  try {
    sinais = await repos.sinaisVida();
  } catch {
    return { ok: false, falhas: ['banco'] as Falha[], sinais: {} as Record<string, string> };
  }
  const recente = (c: string) => Boolean(sinais[c] && agora.getTime() - sinais[c].getTime() < LIMITES_SAUDE.sinalMs);
  const falhas: Falha[] = [];
  if (!recente('fila')) falhas.push('batimento');
  if (!recente('whatsapp')) falhas.push('whatsapp');
  return { ok: falhas.length === 0, falhas, sinais: Object.fromEntries(Object.entries(sinais).map(([k, v]) => [k, v.toISOString()])) };
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
      // O segredo do webhook faz parte da URL: nunca vai para o log.
      // O token do /saude (?token=) também não.
      serializers: { req: (req) => ({ method: req.method, url: req.url.replace(/\/webhook\/zapi\/[^/?]+/, '/webhook/zapi/***').replace(/([?&]token=)[^&]*/, '$1***') }) },
    },
  });

  app.post<{ Params: { segredo: string } }>('/webhook/zapi/:segredo', async (req, rep) => {
    if (!segredoConfere(req.params.segredo, d.segredo)) return rep.code(401).send();
    const m = d.canal.interpretarWebhook(req.body);
    if (!m || m.ehGrupo) return { ok: true };

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
      req.log.warn({ telefone: bruto }, 'mensagem de número fora do formato brasileiro');
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
      clienteId: conversa.cliente_em_foco,
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
    const s = await avaliarSaude(d.repos, d.relogio());
    const cabecalho = req.headers['x-saude-token'];
    const dado = (typeof cabecalho === 'string' ? cabecalho : undefined) ?? req.query.token ?? '';
    // Sem token (ou errado): só o ok, para o monitor público; nada de 401 (o monitor sem token continua funcionando).
    const detalhes = Boolean(d.saudeToken) && segredoConfere(dado, d.saudeToken!);
    return rep.code(s.ok ? 200 : 503).send(detalhes ? { ...s, ambiente: d.ambiente ?? null } : { ok: s.ok });
  });
  // D3: o HEALTHCHECK do contêiner; só diz que o processo responde (WhatsApp ou banco fora não reiniciam o trabalhador em laço).
  app.get('/vivo', async () => ({ ok: true }));

  return app;
}
