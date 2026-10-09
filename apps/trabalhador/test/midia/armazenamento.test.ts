import { describe, expect, it, vi } from 'vitest';
import { TIPO_GENERICO, TIPOS_ANEXOS, TIPOS_DOCUMENTOS } from '@escritorio/core';
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

  it('revisão da Task 10: tipo fora da lista (.pfx, .rar, svg) sobe como application/octet-stream e a mensagem guarda o original', async () => {
    for (const [nome, tipo] of [['certificado.pfx', 'application/x-pkcs12'], ['notas.rar', 'application/vnd.rar'], ['x.svg', 'image/svg+xml'],
      ['dados.bin', 'binary/octet-stream']] as const) {
      const baixar = vi.fn().mockResolvedValue(new Response(new Uint8Array([4, 5, 6])));
      const a = criarArmazenamento(db, baixar);
      const salvo = await a.baixarESalvar(`https://f004.backblazeb2.com/${nome}`, crypto.randomUUID(), nome, tipo);
      expect(salvo.mime).toBe(tipo);
      expect([...(await a.ler(salvo.path))]).toEqual([4, 5, 6]);
      const pasta = salvo.path.slice(0, salvo.path.lastIndexOf('/'));
      const { data } = await db.storage.from('anexos').list(pasta);
      expect(data?.[0]?.metadata?.mimetype).toBe(TIPO_GENERICO);
      await a.remover([salvo.path]);
    }
  });

  it('a lista de tipos do código é a mesma dos compartimentos no Storage', async () => {
    for (const [bucket, lista] of [['anexos', TIPOS_ANEXOS], ['documentos', TIPOS_DOCUMENTOS]] as const) {
      const { data, error } = await db.storage.getBucket(bucket);
      expect(error).toBeNull();
      expect([...(data!.allowed_mime_types ?? [])].sort()).toEqual([...lista].sort());
    }
  });
});
