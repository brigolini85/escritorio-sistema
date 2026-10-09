import { describe, expect, it, vi } from 'vitest';
import { criarClienteServico } from '@escritorio/db';
import { criarArmazenamento } from '../../src/midia/armazenamento';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

describe('armazenamento', () => {
  it('baixa da origem, salva em conversas/{id}/, lê de volta e remove', async () => {
    const baixar = vi.fn().mockResolvedValue(new Response(new Uint8Array([7, 8, 9]), { headers: { 'content-type': 'application/pdf' } }));
    const a = criarArmazenamento(db, baixar);
    const conversaId = crypto.randomUUID();
    const salvo = await a.baixarESalvar('https://f004.backblazeb2.com/extrato.pdf', conversaId, 'extrato.pdf', null);
    expect(salvo.path).toMatch(new RegExp(`^conversas/${conversaId}/\\d+-extrato\\.pdf$`));
    expect(salvo.mime).toBe('application/pdf');
    expect([...(await a.ler(salvo.path))]).toEqual([7, 8, 9]);
    expect(await a.urlAssinada(salvo.path, 60)).toContain('token=');
    await a.remover([salvo.path]);
    await expect(a.ler(salvo.path)).rejects.toThrow();
  });

  it('auditoria 6.9: áudio de voz com parâmetros ("audio/ogg; codecs=opus") entra no compartimento com lista de tipos', async () => {
    const baixar = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'audio/ogg; codecs=opus' } }));
    const a = criarArmazenamento(db, baixar);
    const salvo = await a.baixarESalvar('https://f004.backblazeb2.com/voz.ogg', crypto.randomUUID(), 'voz.ogg', 'Audio/OGG;codecs=opus');
    expect(salvo.mime).toBe('Audio/OGG;codecs=opus');
    expect(await a.tamanho(salvo.path)).toBe(2);
    await a.remover([salvo.path]);
  });

  it('auditoria 6.9: tipo que o navegador executa (svg) é recusado pelo compartimento', async () => {
    const baixar = vi.fn().mockResolvedValue(new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }));
    const a = criarArmazenamento(db, baixar);
    await expect(a.baixarESalvar('https://f004.backblazeb2.com/x.svg', crypto.randomUUID(), 'x.svg', null)).rejects.toThrow(/upload falhou/);
  });
});
