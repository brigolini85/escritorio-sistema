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
});
