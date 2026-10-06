import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { telefoneDoWhatsApp } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import type { CanalWhatsApp } from './canal/tipos';
import { FILAS, agendarProcessamento, type Fila } from './fila';

export type DepsServidor = { canal: CanalWhatsApp; repos: Repos; fila: Fila; segredo: string; relogio: () => Date };

const LIMITE_SINAL_MS = 3 * 60_000;

function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function criarServidor(d: DepsServidor): FastifyInstance {
  const app = Fastify({
    bodyLimit: 1_000_000,
    logger: {
      level: 'info',
      // O segredo do webhook faz parte da URL: nunca vai para o log.
      serializers: { req: (req) => ({ method: req.method, url: req.url.replace(/\/webhook\/zapi\/[^/?]+/, '/webhook/zapi/***') }) },
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

  app.get('/saude', async (_req, rep) => {
    const sinais = await d.repos.sinaisVida();
    const agora = d.relogio().getTime();
    const ok = ['fila', 'whatsapp'].every((c) => sinais[c] && agora - sinais[c].getTime() < LIMITE_SINAL_MS);
    return rep.code(ok ? 200 : 503).send({ ok, sinais });
  });

  return app;
}
