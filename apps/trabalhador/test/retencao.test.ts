import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { criarArmazenamento } from '../src/midia/armazenamento';
import {
  caminhoParaAlerta, criarStorageVarredura, limparRetencao, varrerERegistrar, varrerOrfaos, type Compartimento, type StorageVarredura,
} from '../src/retencao';
import { db, repos } from './apoio/cenario';
import { criarUsuarioTeste } from './apoio/usuario';

beforeEach(limparBanco);

describe('limparRetencao', () => {
  it('apaga mensagens, arquivos e decisões com mais de 1 ano e mantém as recentes', async () => {
    const midia = criarArmazenamento(db, vi.fn().mockResolvedValue(new Response(new Uint8Array([1]))));
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const salvo = await midia.baixarESalvar('https://f004.backblazeb2.com/a.pdf', conversa.id, 'a.pdf', 'application/pdf');
    const antigo = '2025-01-01T12:00:00Z';
    // Inserções separadas: num insert em lote, a chave ausente (criado_em) vira null em vez do padrão.
    const velha = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'entrada', autor: 'cliente', tipo: 'documento', arquivo_path: salvo.path, criado_em: antigo });
    const nova = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'recente' });
    expect([velha.error, nova.error]).toEqual([null, null]);
    await db.from('decisoes_agente').insert({ conversa_id: conversa.id, etapa: 'responder', criado_em: antigo });

    const r = await limparRetencao(db, midia, new Date('2026-09-28T12:00:00Z'));
    // Auditoria 6.3: o resultado ganhou as etapas novas (todas zero aqui: a conversa é de agora).
    expect(r).toEqual({ mensagens: 1, arquivos: 1, decisoes: 1, assistente: 0, simulacoes: 0, sugestoes: 0,
      conversas: 0, eventosConversa: 0, demandas: 0, alertas: 0, auditoria: 0, foraDoAcesso: 0, radar: 0 });
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

  it('sugestões de resposta ficam só 1 dia', async () => {
    const usuario = await criarUsuarioTeste({ email: 'ret@sugestao.local' });
    const conversa = await repos.obterOuCriarConversa('5531966665555', null);
    // Inserções separadas: num insert em lote, a chave ausente (criado_em) vira null em vez do padrão.
    const velha = await db.from('sugestoes_resposta').insert(
      { usuario_id: usuario, conversa_id: conversa.id, status: 'pronta', texto: 'velha', criado_em: new Date(Date.now() - 2 * 86_400_000).toISOString() });
    const nova = await db.from('sugestoes_resposta').insert({ usuario_id: usuario, conversa_id: conversa.id, status: 'falhou', erro: 'nova' });
    expect([velha.error, nova.error]).toEqual([null, null]);
    const r = await limparRetencao(db, criarArmazenamento(db));
    expect(r.sugestoes).toBe(1);
    expect((await db.from('sugestoes_resposta').select('erro')).data).toEqual([{ erro: 'nova' }]);
  });
});

describe('limparRetencao: o que o manual promete (auditoria 6.3)', () => {
  it('apaga a conversa parada há mais de 1 ano, a demanda concluída há mais de 1 ano, alertas e auditoria velha', async () => {
    const velha = await db.from('conversas')
      .insert({ telefone: '5531999991501', criado_em: '2024-01-01T00:00:00Z', atualizado_em: '2024-01-01T00:00:00Z' }).select('id').single();
    expect(velha.error).toBeNull();
    const nova = await repos.obterOuCriarConversa('5531999991502', null);
    const { data: cliente } = await db.from('clientes').insert({ razao_social: 'Retenção 15', cnpj: '15150000000101' }).select('id').single();
    const { data: dem } = await db.from('chamados').insert({ cliente_id: cliente!.id, titulo: 'Antiga', resumo: 'antiga' }).select('id').single();
    await db.from('chamados').update({ status: 'concluido' }).eq('id', dem!.id);
    await db.from('chamados').update({ concluido_em: '2024-06-01T00:00:00Z' }).eq('id', dem!.id);
    await db.from('alertas').insert({ nivel: 'aviso', mensagem: 'velho', criado_em: '2024-01-01T00:00:00Z' });
    await db.from('alertas').insert({ nivel: 'aviso', mensagem: 'novo' });
    await db.from('auditoria_acessos').insert({ acao: 'editar', entidade: 'teste15', criado_em: '2020-01-01T00:00:00Z' });
    await db.from('auditoria_acessos').insert({ acao: 'editar', entidade: 'teste15', criado_em: '2023-01-01T00:00:00Z' });

    const r = await limparRetencao(db, criarArmazenamento(db), new Date('2026-10-10T12:00:00Z'));
    expect(r).toMatchObject({ conversas: 1, demandas: 1, alertas: 1, auditoria: 1 });
    expect((await db.from('conversas').select('id')).data).toEqual([{ id: nova.id }]);
    expect((await db.from('chamados').select('id').eq('id', dem!.id)).data).toEqual([]);
    expect((await db.from('alertas').select('mensagem')).data).toEqual([{ mensagem: 'novo' }]);
    expect((await db.from('auditoria_acessos').select('criado_em').eq('entidade', 'teste15')).data).toHaveLength(1);
  });

  it('apaga em lotes: a primeira rodada leva todo o atraso', async () => {
    const linhas = Array.from({ length: 1205 }, (_, i) => ({ nivel: 'aviso', mensagem: `velho ${i}`, criado_em: '2024-01-01T00:00:00Z' }));
    expect((await db.from('alertas').insert(linhas)).error).toBeNull();
    const r = await limparRetencao(db, criarArmazenamento(db), new Date('2026-10-10T12:00:00Z'));
    expect(r.alertas).toBe(1205);
  });
});

/** Storage falso: os objetos em memória (páginas de 3), com a data de criação; a referência é a do banco (caminhos_referenciados). */
function storageFalso(objetos: Partial<Record<Compartimento, { nome: string; criadoEm: string }[]>>) {
  const real = criarStorageVarredura(db);
  const removidos: string[] = [];
  const storage: StorageVarredura = {
    async listar(bucket, depois) {
      return [...(objetos[bucket] ?? [])].filter((o) => depois === null || o.nome > depois)
        .sort((a, b) => (a.nome < b.nome ? -1 : 1)).slice(0, 3);
    },
    semReferencia: real.semReferencia,
    async remover(bucket, nomes) {
      removidos.push(...nomes.map((n) => `${bucket}:${n}`));
      objetos[bucket] = (objetos[bucket] ?? []).filter((o) => !nomes.includes(o.nome));
    },
  };
  return { storage, removidos };
}

const AGORA = new Date('2026-10-10T12:00:00Z');
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();

describe('varredura de arquivos sem dono (auditoria 6.4)', () => {
  async function cenario() {
    const conversa = await repos.obterOuCriarConversa('5531999991601', null);
    const referenciado = `conversas/${conversa.id}/1700000000000-referenciado.pdf`;
    await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'entrada', autor: 'cliente', tipo: 'documento', arquivo_path: referenciado });
    const objetos: Partial<Record<Compartimento, { nome: string; criadoEm: string }[]>> = {
      anexos: [
        { nome: referenciado, criadoEm: diasAtras(30) },
        { nome: `conversas/${conversa.id}/1700000000001-Joao_Silva_RG.pdf`, criadoEm: diasAtras(8) },
        { nome: `conversas/${conversa.id}/1700000000002-novo.pdf`, criadoEm: diasAtras(1) },
      ],
      tarefas: [{ nome: '0b7e0000-0000-4000-8000-000000000001/1700000000003-extrato.pdf', criadoEm: diasAtras(9) }],
    };
    return { conversa, objetos };
  }

  it('só relatório (padrão): conta o órfão de 8 dias, não conta o de 1 dia nem o referenciado, e não apaga nada', async () => {
    const { objetos } = await cenario();
    const { storage, removidos } = storageFalso(objetos);
    const r = await varrerOrfaos(storage, { apagar: false, agora: AGORA });
    expect(r.candidatos).toEqual({ anexos: 1, documentos: 0, tarefas: 1 });
    expect(r.apagados).toBe(0);
    expect(removidos).toEqual([]);
    // Amostra sem nome de arquivo (pode ter nome de pessoa): só compartimento, códigos e o começo numérico.
    expect(r.amostra.join(' ')).not.toMatch(/Joao|extrato/);
    expect(r.amostra[0]).toMatch(/^anexos:conversas\/[0-9a-f-]{36}\/1700000000001…$/);
  });

  it('ligada: o órfão de 8 dias sai, o de 1 dia fica, o referenciado fica', async () => {
    const { objetos, conversa } = await cenario();
    const { storage, removidos } = storageFalso(objetos);
    const r = await varrerOrfaos(storage, { apagar: true, agora: AGORA });
    expect(removidos.sort()).toEqual([
      `anexos:conversas/${conversa.id}/1700000000001-Joao_Silva_RG.pdf`,
      'tarefas:0b7e0000-0000-4000-8000-000000000001/1700000000003-extrato.pdf',
    ]);
    expect(r.apagados).toBe(2);
  });

  it('ligada: no máximo o limite por rodada; o total segue contado', async () => {
    const objetos = { documentos: Array.from({ length: 7 }, (_, i) => ({ nome: `clientes/x/${1700000000000 + i}-d.pdf`, criadoEm: diasAtras(10) })) };
    const { storage, removidos } = storageFalso(objetos);
    const r = await varrerOrfaos(storage, { apagar: true, agora: AGORA, limite: 5 });
    expect(removidos).toHaveLength(5);
    expect(r.candidatos.documentos).toBe(7);
  });

  it('registra o resultado em alertas (operacional) e só apaga com a chave das configurações ligada', async () => {
    const { objetos } = await cenario();
    const { storage, removidos } = storageFalso(objetos);
    const criticos: string[] = [];
    const alertas = { alertar: async (a: { nivel: string; mensagem: string }) => { if (a.nivel === 'critico') criticos.push(a.mensagem); } };
    await varrerERegistrar({ db, storage, repos, alertas }, AGORA);
    expect(removidos).toEqual([]);
    const { data } = await db.from('alertas').select('nivel, mensagem');
    expect(data).toHaveLength(1);
    expect(data![0]!.nivel).toBe('operacional');
    expect(data![0]!.mensagem).toMatch(/^Varredura semanal de arquivos sem dono \(só relatório, nada foi apagado\): anexos 1, documentos 0, tarefas 1\./);
    expect(data![0]!.mensagem).not.toMatch(/Joao|extrato|5531/);
    expect(criticos).toEqual([]);

    await db.from('configuracoes').update({ varredura_orfaos_apagar: true }).eq('id', 1);
    try {
      await varrerERegistrar({ db, storage, repos, alertas }, AGORA);
    } finally {
      await db.from('configuracoes').update({ varredura_orfaos_apagar: false }).eq('id', 1);
    }
    expect(removidos).toHaveLength(2);
  });

  it('falha: alerta operacional e um crítico por dia; o erro segue para o job', async () => {
    const criticos: string[] = [];
    const alertas = { alertar: async (a: { nivel: string; mensagem: string }) => { if (a.nivel === 'critico') criticos.push(a.mensagem); } };
    const storage: StorageVarredura = { listar: async () => { throw new Error('storage fora'); }, semReferencia: async () => [], remover: async () => {} };
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(varrerERegistrar({ db, storage, repos, alertas }, AGORA)).rejects.toThrow('storage fora');
    await expect(varrerERegistrar({ db, storage, repos, alertas }, AGORA)).rejects.toThrow('storage fora');
    erro.mockRestore();
    expect(criticos).toHaveLength(1);
    const { data } = await db.from('alertas').select('mensagem').eq('nivel', 'operacional');
    expect(data![0]!.mensagem).toMatch(/^Varredura semanal de arquivos sem dono com falha/);
  });
});

describe('caminhoParaAlerta', () => {
  it('mostra só o compartimento, os códigos e o começo numérico do nome', () => {
    expect(caminhoParaAlerta('documentos', 'clientes/0b7e0000-0000-4000-8000-000000000001/1700000000000-Contrato Maria.pdf'))
      .toBe('documentos:clientes/0b7e0000-0000-4000-8000-000000000001/1700000000000…');
    expect(caminhoParaAlerta('tarefas', 'Maria/foto.png')).toBe('tarefas:…/…');
  });
});
