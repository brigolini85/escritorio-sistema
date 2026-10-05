import { expect, type Page } from '@playwright/test';
import { db } from './apoio';

// Parte H2: a Rede Bom Preço da imagem 00-cliente-contatos-acesso (dados de exemplo).
export const PREFIXO_H2 = 'H2E2E';
const TEL = (n: string) => `551190000${n}`;

export async function limparH2(): Promise<void> {
  await db.from('clientes').delete().like('razao_social', `${PREFIXO_H2}%`);
  await db.from('contatos').delete().like('telefone', '551190000%');
  await db.from('servicos').delete().like('nome', `${PREFIXO_H2}%`);
  await db.from('setores').delete().eq('nome', `${PREFIXO_H2} Auditoria`);
}

const setor = async (nome: string) => (await db.from('setores').select('id').eq('nome', nome).single()).data!.id as string;

export async function semearAcesso() {
  await limparH2();
  const setores = { fiscal: await setor('Fiscal'), pessoal: await setor('Pessoal'), contabil: await setor('Contábil'), legal: await setor('Legalização') };
  // Setor que a Rede não contrata: não aparece no bloco (D5).
  await db.from('setores').insert({ nome: `${PREFIXO_H2} Auditoria`, descricao_assuntos: 'Revisão' });
  const cliente = async (razao: string, cnpj: string) => (await db.from('clientes').insert({ razao_social: `${PREFIXO_H2} ${razao}`, cnpj }).select('id').single()).data!.id as string;
  const rede = await cliente('Rede Bom Preço Ltda', '11222333000181');
  const padaria = await cliente('Padaria Sol ME', '11444777000161');
  for (const [nome, s] of [['Fiscal', setores.fiscal], ['Folha', setores.pessoal], ['Contábil', setores.contabil], ['Legalização', setores.legal]] as const) {
    const { data } = await db.from('servicos').insert({ nome: `${PREFIXO_H2} ${nome}`, setor_id: s }).select('id').single();
    await db.from('cliente_servicos').insert({ cliente_id: rede, servico_id: data!.id });
  }
  const contato = async (nome: string, tel: string, extra: object = {}) =>
    (await db.from('contatos').insert({ nome, telefone: TEL(tel), ...extra }).select('id').single()).data!.id as string;
  const roberto = await contato('Roberto Faria', '0001', { cargo: 'Sócio-administrador', email: 'roberto@bompreco.com.br' });
  const carla = await contato('Carla Mendes', '2211', { cargo: 'Compras', email: 'carla@bompreco.com.br' });
  const patricia = await contato('Patrícia Gomes', '1020', { cargo: 'RH', email: 'rh@bompreco.com.br' });
  const semNome = await contato('(11) 95555-7788', '7788');
  await db.from('contato_clientes').insert([
    { contato_id: roberto, cliente_id: rede, perfil: 'socio', pode_pedir_nota: true, pode_atualizar_preco: true, ver_valores: true, receber_documentos: true, avisar_documento_novo: ['whatsapp'], recebe_alertas_acesso: true },
    { contato_id: carla, cliente_id: rede },
    { contato_id: carla, cliente_id: padaria },
    { contato_id: patricia, cliente_id: rede, perfil: 'rh_dp', ver_valores: true, receber_documentos: true, avisar_documento_novo: ['whatsapp'] },
    { contato_id: semNome, cliente_id: rede },
  // Lote com chaves diferentes: sem defaultToNull:false, as colunas ausentes iriam como null (e o perfil não aceita null).
  ], { defaultToNull: false }).then(({ error }) => { if (error) throw error; });
  await db.from('contato_cliente_setores').insert([
    ...[setores.fiscal, setores.pessoal, setores.contabil, setores.legal, await setor('Financeiro')].map((s) => ({ contato_id: roberto, cliente_id: rede, setor_id: s, pode_ser_procurado: true })),
    { contato_id: patricia, cliente_id: rede, setor_id: setores.pessoal, pode_ser_procurado: true },
  ]).then(({ error }) => { if (error) throw error; });
  return { rede, padaria, roberto, carla, patricia, semNome, setores };
}

/** Abre a linha do contato na ficha e espera o bloco hidratar (antes disso o Salvar fica desligado). */
export async function abrirAcesso(page: Page, nome: string) {
  await page.getByRole('button', { name: `Abrir o acesso de ${nome}` }).click();
  const bloco = page.getByRole('group', { name: `Acesso de ${nome}` });
  await expect(bloco).toHaveAttribute('data-acesso-hidratado', '');
  return bloco;
}

export const acessoNoBanco = async (contato: string, cliente: string) => {
  const { data } = await db.from('contato_clientes').select('perfil, pode_pedir_nota, ver_valores, contato_cliente_setores(setor_id, pode_ser_procurado)')
    .eq('contato_id', contato).eq('cliente_id', cliente).single();
  return data!;
};
