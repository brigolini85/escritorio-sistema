import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { limparRetencao } from '../src/retencao';
import { db, repos } from './apoio/cenario';
import { criarUsuarioTeste } from './apoio/usuario';

beforeEach(limparBanco);

describe('limparRetencao', () => {
  it('apaga mensagens, arquivos e decisões com mais de 1 ano e mantém as recentes', async () => {
    const midia = criarArmazenamento(db, vi.fn().mockResolvedValue(new Response(new Uint8Array([1]))));
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const salvo = await midia.baixarESalvar('https://x/a.pdf', conversa.id, 'a.pdf', 'application/pdf');
    const antigo = '2025-01-01T12:00:00Z';
    // Inserções separadas: num insert em lote, a chave ausente (criado_em) vira null em vez do padrão.
    const velha = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'entrada', autor: 'cliente', tipo: 'documento', arquivo_path: salvo.path, criado_em: antigo });
    const nova = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'recente' });
    expect([velha.error, nova.error]).toEqual([null, null]);
    await db.from('decisoes_agente').insert({ conversa_id: conversa.id, etapa: 'responder', criado_em: antigo });

    const r = await limparRetencao(db, midia, new Date('2026-09-28T12:00:00Z'));
    expect(r).toEqual({ mensagens: 1, arquivos: 1, decisoes: 1, assistente: 0, simulacoes: 0 });
    expect((await db.from('mensagens').select('conteudo')).data).toEqual([{ conteudo: 'recente' }]);
    await expect(midia.ler(salvo.path)).rejects.toThrow();
  });

  it('apaga as conversas com o assistente com mais de 1 ano (pedido do dono, 2026-09-29)', async () => {
    const id = await criarUsuarioTeste({ email: 'dono@teste-retencao.local' });
    await db.from('assistente_mensagens').insert({ usuario_id: id, canal: 'site', papel: 'usuario', conteudo: 'antiga', criado_em: '2024-01-01T00:00:00Z' });
    await db.from('assistente_mensagens').insert({ usuario_id: id, canal: 'site', papel: 'usuario', conteudo: 'nova' });
    const r = await limparRetencao(db, criarArmazenamento(db), new Date('2026-09-29T12:00:00Z'));
    expect(r.assistente).toBe(1);
    expect((await db.from('assistente_mensagens').select('conteudo')).data).toEqual([{ conteudo: 'nova' }]);
  });

  it('apaga os testes do agente com mais de 30 dias (Treinar o agente, 2026-09-30)', async () => {
    const id = await criarUsuarioTeste({ email: 'marcada@teste-retencao.local' });
    await db.from('simulacoes_agente').insert({ usuario_id: id, mensagem: 'antiga', status: 'pronta', criado_em: '2026-08-30T11:00:00Z' });
    await db.from('simulacoes_agente').insert({ usuario_id: id, mensagem: 'recente', status: 'pronta', criado_em: '2026-08-31T13:00:00Z' });
    const r = await limparRetencao(db, criarArmazenamento(db), new Date('2026-09-30T12:00:00Z'));
    expect(r.simulacoes).toBe(1);
    expect((await db.from('simulacoes_agente').select('mensagem')).data).toEqual([{ mensagem: 'recente' }]);
  });
});
