import { criarClienteServico, criarRepos } from '@escritorio/db';

export const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const repos = criarRepos(db);

export async function setorId(nome: string): Promise<string> {
  const { data } = await db.from('setores').select('id').eq('nome', nome).single();
  return data!.id;
}

/** Cria empresas (CNPJs distintos), um contato ligado a elas e a conversa do contato. */
export async function contatoComEmpresas(nomes: string[], telefone = '5531999990001') {
  const empresas = [];
  for (const [i, nome] of nomes.entries()) {
    const { data } = await db.from('clientes').insert({ razao_social: nome, cnpj: String(11222333000100 + i).padStart(14, '0') }).select().single();
    empresas.push(data!);
  }
  const { data: contato } = await db.from('contatos').insert({ nome: 'João', telefone }).select().single();
  for (const e of empresas) await db.from('contato_clientes').insert({ contato_id: contato!.id, cliente_id: e.id });
  const conversa = await repos.obterOuCriarConversa(telefone, contato!.id);
  return { empresas, contato: contato!, conversa };
}
export type CadastrosExemplo = {
  brasilEfigenia: string; brasilMatilde: string; hortsul: string[]; boiBom: string;
  costela: string; frango: string; alho: string; contrato: string; balanco: string;
};

/** Cadastros inventados no estilo das conversas reais (indústria de alimentos). */
export async function criarCadastrosExemplo(clienteId: string): Promise<CadastrosExemplo> {
  const grupo = async (tipo: 'cliente' | 'fornecedor', nome: string, palavras_chave: string[] = []) =>
    (await db.from('parceiros_grupos').insert({ cliente_id: clienteId, tipo, nome, palavras_chave }).select().single()).data!.id;
  const unidade = async (grupo_id: string, nome_unidade: string, extra: object = {}) =>
    (await db.from('parceiros_unidades').insert({ cliente_id: clienteId, grupo_id, nome_unidade, ...extra }).select().single()).data!.id;
  const produto = async (codigo: string, descricao: string, apelidos: string[]) =>
    (await db.from('produtos').insert({ cliente_id: clienteId, codigo, descricao, unidade: 'PAC', apelidos }).select().single()).data!.id;

  const brasil = await grupo('cliente', 'Supermercado Brasil', ['brasil']);
  const brasilEfigenia = await unidade(brasil, 'Santa Efigênia', { razao_social: 'Supermercado Brasil Ltda', cnpj: '11111111000191', inscricao_estadual: '0012345670011', bairro: 'Santa Efigênia', cidade: 'Belo Horizonte', uf: 'MG' });
  const brasilMatilde = await unidade(brasil, 'Santa Matilde', { razao_social: 'Supermercado Brasil Ltda', cnpj: '11111111000272', bairro: 'Santa Matilde', cidade: 'Belo Horizonte', uf: 'MG' });
  const hortsulGrupo = await grupo('cliente', 'Hortsul');
  const hortsul = [
    await unidade(hortsulGrupo, 'Gutierrez', { bairro: 'Gutierrez', cidade: 'Belo Horizonte', uf: 'MG' }),
    await unidade(hortsulGrupo, 'Jardim Canadá', { bairro: 'Jardim Canadá', cidade: 'Nova Lima', uf: 'MG' }),
    await unidade(hortsulGrupo, 'Itabira', { bairro: 'Centro', cidade: 'Itabira', uf: 'MG' }),
  ];
  const boi = await grupo('fornecedor', 'Frigorífico Boi Bom', ['boi bom']);
  const boiBom = await unidade(boi, 'Matriz', { razao_social: 'Frigorífico Boi Bom Ltda', cnpj: '22222222000191', cidade: 'Contagem', uf: 'MG' });
  const costela = await produto('12', 'Costela com Requeijão', ['costela']);
  const frango = await produto('14', 'Frango com Requeijão', ['frango']);
  const alho = await produto('20', 'Alho Poró', ['alho', 'alho poro']);
  await db.from('precos').insert([
    { cliente_id: clienteId, grupo_id: brasil, produto_id: costela, valor: 9.5 },
    { cliente_id: clienteId, grupo_id: brasil, produto_id: frango, valor: 9 },
  ]);
  const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);   // "%PDF-1.4"
  const doc = async (nome: string, arquivo: string, ia_pode_enviar: boolean) => {
    const arquivo_path = `clientes/${clienteId}/${arquivo}`;
    await db.storage.from('documentos').upload(arquivo_path, pdf, { contentType: 'application/pdf', upsert: true });
    return (await db.from('documentos_empresa').insert({ cliente_id: clienteId, nome, arquivo_path, arquivo_nome: arquivo, ia_pode_enviar }).select().single()).data!.id;
  };
  const contrato = await doc('Contrato social', 'contrato-social.pdf', true);
  const balanco = await doc('Balanço 2025', 'balanco-2025.pdf', false);
  return { brasilEfigenia, brasilMatilde, hortsul, boiBom, costela, frango, alho, contrato, balanco };
}
