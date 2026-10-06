// Revisão geral I9: a chamada à Z-API não tinha prazo (até ~300 s esperando os cabeçalhos) e a reserva da resposta do painel
// vencia em 2 min: o batimento reenfileirava e outro job mandava de novo (cliente recebia duas vezes).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { PRAZO_ZAPI_MS, criarCanalZapi } from '../src/canal/zapi';
import { RESERVA_ENVIO_MINUTOS } from '@escritorio/db';
import { db, repos } from './apoio/cenario';

const cfg = { instancia: 'INST', token: 'TOK', clientToken: 'CT' };
const ok = () => vi.fn().mockImplementation(async () => new Response(JSON.stringify({ messageId: 'M1', connected: true })));

describe('prazo das chamadas à Z-API', () => {
  it('texto, arquivo e status levam um sinal de cancelamento; os prazos ficam abaixo da reserva do envio', async () => {
    const buscar = ok();
    const canal = criarCanalZapi(cfg, buscar);
    await canal.enviarTexto('5531999990001', 'oi');
    await canal.enviarArquivo('5531999990001', { url: 'data:application/pdf;base64,AA==', nome: 'a.pdf' });
    await canal.status();
    for (const c of buscar.mock.calls) expect((c[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    expect(PRAZO_ZAPI_MS.arquivo).toBeLessThan(RESERVA_ENVIO_MINUTOS * 60_000 / 2);
    expect(PRAZO_ZAPI_MS.texto).toBeLessThanOrEqual(PRAZO_ZAPI_MS.arquivo);
  });

  it('chamada que passa do prazo vira erro (a reserva é solta e a fila tenta de novo)', async () => {
    const buscar = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rej) => {
      init.signal!.addEventListener('abort', () => rej(init.signal!.reason));
    }));
    const canal = criarCanalZapi(cfg, buscar as never, { texto: 50, arquivo: 50, status: 50 });
    await expect(canal.enviarTexto("5531999990001", "oi")).rejects.toThrow("prazo");
  });
});

describe('batimento e reserva da resposta do painel', () => {
  beforeEach(async () => { await limparBanco(); });

  it('resposta pendente com reserva ainda valendo não volta para a fila; sem reserva ou vencida, volta', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const antiga = new Date(Date.now() - 10 * 60_000).toISOString();
    const nova = (envio_reservado_em: string | null) => db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente',
      tipo: 'texto', conteudo: 'Segue', status_envio: 'pendente', criado_em: antiga, envio_reservado_em }).select('id').single().then((r) => r.data!.id);
    const reservada = await nova(new Date(Date.now() - 60_000).toISOString());
    const semReserva = await nova(null);
    const vencida = await nova(new Date(Date.now() - (RESERVA_ENVIO_MINUTOS + 1) * 60_000).toISOString());
    expect((await repos.respostasPendentesAntigas(2)).sort()).toEqual([semReserva, vencida].sort());
    expect(await repos.reservarEnvio(reservada)).toBe(false);
    expect(await repos.reservarEnvio(vencida)).toBe(true);
  });
});
