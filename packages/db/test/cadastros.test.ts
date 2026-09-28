import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos, type Database } from '../src';
import { limparBanco } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);

async function empresa(nome: string, cnpj: string) {
  const { data } = await db.from('clientes').insert({ razao_social: nome, cnpj }).select().single();
  return data!.id;
}

beforeEach(limparBanco);

describe('cadastros da empresa', () => {
  it('unidades: só da empresa pedida, do tipo pedido e ativas (rede e unidade)', async () => {
    const x = await empresa('Indústria X', '11222333000181');
    const y = await empresa('Indústria Y', '99888777000166');
    const { data: brasil } = await db.from('parceiros_grupos').insert({ cliente_id: x, tipo: 'cliente', nome: 'Supermercado Brasil', palavras_chave: ['brasil'] }).select().single();
    const { data: velha } = await db.from('parceiros_grupos').insert({ cliente_id: x, tipo: 'cliente', nome: 'Rede Antiga', ativo: false }).select().single();
    const { data: boi } = await db.from('parceiros_grupos').insert({ cliente_id: x, tipo: 'fornecedor', nome: 'Frigorífico Boi Bom' }).select().single();
    const { data: outra } = await db.from('parceiros_grupos').insert({ cliente_id: y, tipo: 'cliente', nome: 'Supermercado Brasil' }).select().single();
    // Uma por vez: num insert em lote, a coluna ausente vira null (e palavras_chave é not null).
    const novas: Database['public']['Tables']['parceiros_unidades']['Insert'][] = [
      { cliente_id: x, grupo_id: brasil!.id, nome_unidade: 'Santa Efigênia', bairro: 'Santa Efigênia', cnpj: '11111111000191', palavras_chave: ['efigenia'] },
      { cliente_id: x, grupo_id: brasil!.id, nome_unidade: 'Fechada', ativo: false },
      { cliente_id: x, grupo_id: velha!.id, nome_unidade: 'Da rede antiga' },
      { cliente_id: x, grupo_id: boi!.id, nome_unidade: 'Matriz' },
      { cliente_id: y, grupo_id: outra!.id, nome_unidade: 'De outra empresa' },
    ];
    for (const unidade of novas) {
      const { error } = await db.from('parceiros_unidades').insert(unidade);
      expect(error).toBeNull();
    }
    const unidades = await repos.unidadesDaEmpresa(x, 'cliente');
    expect(unidades.map((u) => u.unidade)).toEqual(['Santa Efigênia']);
    expect(unidades[0]).toMatchObject({ rede: 'Supermercado Brasil', tipo: 'cliente', cnpj: '11111111000191', palavrasChave: ['brasil', 'efigenia'] });
    expect((await repos.unidadesDaEmpresa(x, 'fornecedor')).map((u) => u.unidade)).toEqual(['Matriz']);
  });

  it('produtos ativos e preços vigentes da rede', async () => {
    const x = await empresa('Indústria X', '11222333000181');
    const { data: rede } = await db.from('parceiros_grupos').insert({ cliente_id: x, tipo: 'cliente', nome: 'Supermercado Brasil' }).select().single();
    const { data: costela } = await db.from('produtos').insert({ cliente_id: x, codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC', apelidos: ['costela'] }).select().single();
    const { data: frango } = await db.from('produtos').insert({ cliente_id: x, codigo: '14', descricao: 'Frango com Requeijão', unidade: 'PAC' }).select().single();
    await db.from('produtos').insert({ cliente_id: x, codigo: '99', descricao: 'Fora de linha', ativo: false });
    await db.from('precos').insert([
      { cliente_id: x, grupo_id: rede!.id, produto_id: costela!.id, valor: 8, vigente_ate: new Date().toISOString() },
      { cliente_id: x, grupo_id: rede!.id, produto_id: costela!.id, valor: 9.5 },
    ]);
    expect((await repos.produtosDaEmpresa(x)).map((p) => p.codigo).sort()).toEqual(['12', '14']);
    expect(await repos.precosVigentes(x, rede!.id, [costela!.id, frango!.id])).toEqual({ [costela!.id]: 9.5 });
  });

  it('documentos da empresa e setor por nome', async () => {
    const x = await empresa('Indústria X', '11222333000181');
    await db.from('documentos_empresa').insert({ cliente_id: x, nome: 'Contrato social', arquivo_path: `clientes/${x}/contrato.pdf`, arquivo_nome: 'contrato.pdf', ia_pode_enviar: true });
    expect(await repos.documentosDaEmpresa(x)).toEqual([expect.objectContaining({ nome: 'Contrato social', iaPodeEnviar: true, arquivoNome: 'contrato.pdf' })]);
    expect(await repos.setorPorNome('Fiscal')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await repos.setorPorNome('Inexistente')).toBeNull();
  });
});

describe('dados cadastrais da empresa', () => {
  it('dadosDaEmpresa devolve os dados do cadastro da empresa pedida', async () => {
    const { data: x } = await db.from('clientes').insert({ razao_social: 'Indústria X Ltda', nome_fantasia: 'Indústria X', cnpj: '11222333000181',
      inscricao_estadual: '0012345670011', regime: 'Simples Nacional', endereco: 'Rua A, 10', uf: 'MG' }).select().single();
    expect(await repos.dadosDaEmpresa(x!.id)).toEqual({ razaoSocial: 'Indústria X Ltda', nomeFantasia: 'Indústria X', cnpj: '11222333000181',
      inscricaoEstadual: '0012345670011', regime: 'Simples Nacional', endereco: 'Rua A, 10', uf: 'MG' });
  });
});
