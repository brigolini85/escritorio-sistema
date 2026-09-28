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
