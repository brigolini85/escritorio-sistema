// Revisão geral I6: o arquivo do cliente era baixado inteiro para a memória sem limite (o WhatsApp aceita até 2 GB).
import { describe, expect, it, vi } from 'vitest';
import { criarClienteServico } from '@escritorio/db';
import { ArquivoGrandeDemais, LIMITE_DOWNLOAD_BYTES, criarArmazenamento } from '../../src/midia/armazenamento';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Corpo que entrega `total` bytes em pedaços de 1 MB e conta quanto foi lido. */
function corpoGrande(total: number) {
  let entregue = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      if (entregue >= total) { c.close(); return; }
      const n = Math.min(1024 * 1024, total - entregue);
      entregue += n;
      c.enqueue(new Uint8Array(n));
    },
  });
  return { stream, lido: () => entregue };
}

describe('limite do download da mídia do cliente', () => {
  it('content-length acima do limite: recusa sem ler o corpo', async () => {
    const { stream, lido } = corpoGrande(LIMITE_DOWNLOAD_BYTES + 1);
    const baixar = vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-length': String(LIMITE_DOWNLOAD_BYTES + 1) } }));
    const a = criarArmazenamento(db, baixar);
    await expect(a.baixarESalvar('https://f004.backblazeb2.com/grande.pdf', crypto.randomUUID(), 'grande.pdf', null)).rejects.toBeInstanceOf(ArquivoGrandeDemais);
    expect(lido()).toBeLessThanOrEqual(1024 * 1024);
  });

  it('sem content-length: para de ler ao passar do limite', async () => {
    const { stream, lido } = corpoGrande(LIMITE_DOWNLOAD_BYTES * 3);
    const baixar = vi.fn().mockResolvedValue(new Response(stream));
    const a = criarArmazenamento(db, baixar);
    await expect(a.baixarESalvar('https://f004.backblazeb2.com/grande.pdf', crypto.randomUUID(), 'grande.pdf', null)).rejects.toBeInstanceOf(ArquivoGrandeDemais);
    expect(lido()).toBeLessThan(LIMITE_DOWNLOAD_BYTES + 3 * 1024 * 1024);
  });

  it('o download tem prazo (sinal de cancelamento na chamada)', async () => {
    const baixar = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const a = criarArmazenamento(db, baixar);
    const salvo = await a.baixarESalvar('https://f004.backblazeb2.com/a.pdf', crypto.randomUUID(), 'a.pdf', 'application/pdf');
    expect(baixar.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
    await a.remover([salvo.path]);
  });
});

describe('processarConversa com arquivo grande demais', () => {
  it('não baixa, avisa o agente com o motivo e a mensagem não tenta de novo', async () => {
    const { limparBanco } = await import('@escritorio/db/teste');
    const { CanalFalso } = await import('../../src/canal/falso');
    const { LimitadorEnvio } = await import('../../src/envio');
    const { processarConversa } = await import('../../src/processar-conversa');
    const { contatoComEmpresas, repos } = await import('../apoio/cenario');
    const { FilaFalsa } = await import('../apoio/fila-falsa');
    const { IaRoteirizada, fim, usarFerramentas } = await import('../apoio/ia-roteirizada');
    await limparBanco();
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: 'G-1', tipo: 'documento', conteudo: null,
      midiaUrlOrigem: 'https://f004.backblazeb2.com/grande.pdf', arquivoNome: 'grande.pdf', arquivoMime: 'application/pdf' });
    const baixar = vi.fn().mockResolvedValue(new Response(new Uint8Array(1), { headers: { 'content-length': String(LIMITE_DOWNLOAD_BYTES + 1) } }));
    const canal = new CanalFalso();
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Recebi.' } }), fim()]);
    await processarConversa({
      repos, ia, fila: new FilaFalsa(), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
      midia: criarArmazenamento(db, baixar), transcritor: { modelo: 'x', provedor: 'groq', transcrever: vi.fn() },
      alertas: { alertar: async () => {} }, relogio: () => new Date('2026-09-28T13:00:00Z'),
    }, conversa.id, false);
    const pedido = JSON.stringify(ia.recebidos[0]!.messages[0]);
    expect(pedido).toContain('[anexo grande demais: não foi aberto]');
    const { data } = await db.from('mensagens').select('conteudo, midia_url_origem').eq('id_provedor', 'G-1').single();
    expect(data).toEqual({ conteudo: '[anexo grande demais: não foi aberto]', midia_url_origem: null });
  });
});
