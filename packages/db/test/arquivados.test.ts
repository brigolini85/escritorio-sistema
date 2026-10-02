// packages/db/test/arquivados.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';
import { criarUsuario } from './usuario';

// Parte B do painel v2: arquivar = ativo false; o agente e o assistente deixam de ver, e voltam a ver ao restaurar.
const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
const TEL = '5531999991601';
type Tabela = 'clientes' | 'contatos' | 'produtos' | 'parceiros_grupos' | 'parceiros_unidades' | 'usuarios';

async function marcar(tabela: Tabela, id: string, ativo: boolean) {
  const { error } = await db.from(tabela).update({ ativo }).eq('id', id);
  expect(error).toBeNull();
}

beforeEach(limparBanco);

describe('arquivado some do agente e do assistente', () => {
  it('cliente e contato arquivados não são reconhecidos; restaurar devolve', async () => {
    const { data: x } = await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '16160000000101' }).select().single();
    const { data: c } = await db.from('contatos').insert({ nome: 'Maria', telefone: TEL }).select().single();
    await db.from('contato_clientes').insert({ contato_id: c!.id, cliente_id: x!.id });
    expect((await repos.buscarContato(TEL))?.empresas.map((e) => e.nome)).toEqual(['Padaria Sol ME']);
    expect((await repos.buscarEmpresas('Padaria')).map((e) => e.id)).toEqual([x!.id]);

    await marcar('clientes', x!.id, false);
    expect((await repos.buscarContato(TEL))?.empresas).toEqual([]);
    expect(await repos.buscarEmpresas('Padaria')).toEqual([]);
    await marcar('contatos', c!.id, false);
    expect(await repos.buscarContato(TEL)).toBeNull();

    await marcar('clientes', x!.id, true);
    await marcar('contatos', c!.id, true);
    expect((await repos.buscarContato(TEL))?.empresas.map((e) => e.nome)).toEqual(['Padaria Sol ME']);
  });

  it('produto, unidade e rede arquivados saem do que o agente consulta', async () => {
    const { data: x } = await db.from('clientes').insert({ razao_social: 'Indústria X', cnpj: '16160000000202' }).select().single();
    const { data: rede } = await db.from('parceiros_grupos').insert({ cliente_id: x!.id, tipo: 'cliente', nome: 'Supermercado Brasil' }).select().single();
    // Uma por vez: num insert em lote, a coluna ausente vira null (e palavras_chave é not null).
    const { data: efigenia } = await db.from('parceiros_unidades').insert({ cliente_id: x!.id, grupo_id: rede!.id, nome_unidade: 'Santa Efigênia' }).select().single();
    const { data: matilde } = await db.from('parceiros_unidades').insert({ cliente_id: x!.id, grupo_id: rede!.id, nome_unidade: 'Santa Matilde' }).select().single();
    await db.from('produtos').insert({ cliente_id: x!.id, codigo: '12', descricao: 'Costela' });
    const { data: frango } = await db.from('produtos').insert({ cliente_id: x!.id, codigo: '14', descricao: 'Frango' }).select().single();

    await marcar('produtos', frango!.id, false);
    expect((await repos.produtosDaEmpresa(x!.id)).map((p) => p.codigo)).toEqual(['12']);
    // Um pedido antigo que já usa o produto ainda consegue descrevê-lo.
    expect((await repos.produtosDaEmpresa(x!.id, { incluirInativos: true })).map((p) => p.codigo).sort()).toEqual(['12', '14']);

    await marcar('parceiros_unidades', matilde!.id, false);
    expect((await repos.unidadesDaEmpresa(x!.id, 'cliente')).map((u) => u.id)).toEqual([efigenia!.id]);
    await marcar('parceiros_grupos', rede!.id, false);
    expect(await repos.unidadesDaEmpresa(x!.id, 'cliente')).toEqual([]);
    await marcar('parceiros_grupos', rede!.id, true);
    expect((await repos.unidadesDaEmpresa(x!.id, 'cliente')).map((u) => u.id)).toEqual([efigenia!.id]);
  });

  it('pessoa arquivada perde o assistente pelo WhatsApp', async () => {
    const id = await criarUsuario(db, 'bia@arquivados.local', { telefone: '5531999991602', permissoes: ['assistente_whatsapp'] });
    expect((await repos.usuarioDoAssistente('5531999991602'))?.id).toBe(id);
    await marcar('usuarios', id, false);
    expect(await repos.usuarioDoAssistente('5531999991602')).toBeNull();
    expect((await repos.obterUsuarioAssistente(id))?.ativo).toBe(false);
  });

  it('o gatilho grava quando arquivou (sem pessoa, pelo serviço) e restaurar limpa', async () => {
    const { data: x } = await db.from('clientes').insert({ razao_social: 'Indústria Z', cnpj: '16160000000303' }).select().single();
    await marcar('clientes', x!.id, false);
    const arq = (await db.from('clientes').select('arquivado_em, arquivado_por').eq('id', x!.id).single()).data!;
    expect(arq.arquivado_em).not.toBeNull();
    expect(arq.arquivado_por).toBeNull();
    await marcar('clientes', x!.id, true);
    expect((await db.from('clientes').select('arquivado_em, arquivado_por').eq('id', x!.id).single()).data)
      .toEqual({ arquivado_em: null, arquivado_por: null });
  });

  it('telefone de pessoa arquivada deixa de ser interno; ativa continua', async () => {
    const id = await criarUsuario(db, 'caio@arquivados.local', { telefone: '5531999991603' });
    expect(await repos.ehTelefoneInterno('5531999991603')).toBe(true);
    await marcar('usuarios', id, false);
    expect(await repos.ehTelefoneInterno('5531999991603')).toBe(false);
    await marcar('usuarios', id, true);
    expect(await repos.ehTelefoneInterno('5531999991603')).toBe(true);
  });

  it('pessoa arquivada deixa de receber as novas demandas da empresa; restaurar devolve', async () => {
    const { data: x } = await db.from('clientes').insert({ razao_social: 'Indústria R', cnpj: '16160000000404' }).select().single();
    const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
    const { data: pessoal } = await db.from('setores').select('id').eq('nome', 'Pessoal').single();
    const dani = await criarUsuario(db, 'dani@arquivados.local');
    const edu = await criarUsuario(db, 'edu@arquivados.local');
    await db.from('cliente_responsaveis').insert([
      { cliente_id: x!.id, setor_id: fiscal!.id, usuario_id: dani },
      { cliente_id: x!.id, setor_id: pessoal!.id, usuario_id: edu },
    ]);
    expect(await repos.responsaveisDoCliente(x!.id)).toHaveLength(2);

    await marcar('usuarios', dani, false);
    // A demanda do setor da pessoa arquivada fica sem responsável (e cai no alerta), em vez de ir para quem não entra mais.
    expect(await repos.responsaveisDoCliente(x!.id)).toEqual([{ setorId: pessoal!.id, usuarioId: edu }]);
    await marcar('usuarios', dani, true);
    expect(await repos.responsaveisDoCliente(x!.id)).toHaveLength(2);
  });
});
