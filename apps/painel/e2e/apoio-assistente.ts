import { expect, type Page } from '@playwright/test';
import { criarUsuarioTeste, db } from './apoio';

export const SENHA = 'Senha-e2e-123';
export const EMAIL_ANA = 'ana-g4@e2e.local';
export const PREFIXO = 'G4E2E';

/** Abre o Assistente e espera o navegador assumir a página (data-assistente-hidratado). Clicar antes disso perde a ação. */
export async function abrirAssistente(page: Page, consulta = ''): Promise<void> {
  await page.goto(`/assistente${consulta}`);
  await expect(page.locator('[data-assistente-hidratado]')).toHaveCount(1, { timeout: 30_000 });
}

/** Ana, do Fiscal, com o assistente pelo site e (por padrão) "Pedidos de nota: Corrigir e gerar". */
export function criarAna(permissoes = ['assistente_site', 'emitir_notas']): Promise<string> {
  return criarUsuarioTeste({ email: EMAIL_ANA, senha: SENHA, nome: 'Ana G4', papel: 'atendente', setores: ['Fiscal'], permissoes });
}

const corpo = (q: number, sub: string, total: string) => [
  'Destinatário: Rede Bom Preço / Unidade Centro',
  `• ${q} PAC Pão de queijo congelado 1kg (cód. 12) × R$ 18,50 = ${sub}`,
  '• 6 UN Bolo de fubá 400g (cód. 31) × R$ 14,00 = R$ 84,00',
  '• 4 PAC Biscoito de polvilho 200g (cód. 44) × R$ 6,90 = R$ 27,60',
  `Total: ${total}`,
  'Pagamento: Boleto 28 dias · Entrega: 03/10',
].join('\n');

/** A prévia no formato que o trabalhador escreve (descreverPedido): 10 → 15 PAC de pão de queijo. */
export function textoPrevia(numero: number | string, rodape = 'Nada foi gravado. Responda sim para gravar; o CSV sai em seguida.'): string {
  return `Prévia do pedido #${numero}:\nAntes:\n${corpo(10, 'R$ 185,00', 'R$ 296,60')}\nDepois:\n${corpo(15, 'R$ 277,50', 'R$ 389,10')}\n\n${rodape}`;
}

export const TEXTO_TABELA = [
  'São **4 pedidos** em aberto nos seus setores.', '', 'Pedidos em aberto:',
  '| Nº | Empresa | Total |', '|---|---|---|',
  '| #1 | Padaria Sol ME | R$ 389,10 |', '| #2 | Mercado Central | R$ 812,00 |', '| #3 | Rede Bom Preço | R$ 640,30 |', '| #4 | Padaria Sol ME | R$ 277,00 |',
].join('\n');

export const CSV = (chamados: string[], partes = 1, nome = 'bling-pedidos-teste.csv') => ({ tipo: 'csv_bling', chamados, nome, partes });

/** Apaga o que os testes da G4 criaram (demandas, contatos, empresas e setores com o prefixo). */
export async function limparG4(): Promise<void> {
  await db.from('chamados').delete().like('titulo', `${PREFIXO}%`);
  await db.from('contatos').delete().like('nome', `${PREFIXO}%`);
  await db.from('clientes').delete().like('razao_social', `${PREFIXO}%`);
  await db.from('setores').delete().like('nome', `${PREFIXO}%`);
}

/** Demanda de venda da Padaria (10 PAC no banco), aberta pelo agente pelo WhatsApp da Carla. O gatilho grava a 'criacao'. */
export async function semearPedido(setorNome = 'Fiscal') {
  await limparG4();
  let setor = (await db.from('setores').select('id').eq('nome', setorNome).maybeSingle()).data?.id as string | undefined;
  if (!setor) setor = (await db.from('setores').insert({ nome: setorNome, ativo: true }).select('id').single()).data!.id as string;
  const cliente = (await db.from('clientes').insert({ razao_social: `${PREFIXO} Padaria Sol ME`, cnpj: '41000000000101' }).select('id').single()).data!.id as string;
  const contato = (await db.from('contatos').insert({ nome: `${PREFIXO} Carla Mendes`, telefone: '5531940000001' }).select('id').single()).data!.id as string;
  const pedido = {
    unidade_id: null, texto_destinatario: 'Rede Bom Preço / Unidade Centro', data: '01/10/2026', data_prevista: '03/10/2026', forma_pagamento: 'Boleto 28 dias',
    valor_frete: null, tipo_frete: null, transportadora: null, observacoes: null, entrega: null,
    itens: [
      { produto: 'Pão de queijo congelado 1kg', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 18.5 },
      { produto: 'Bolo de fubá 400g', sku: '31', un: 'UN', quantidade: 6, valor_unitario: 14 },
      { produto: 'Biscoito de polvilho 200g', sku: '44', un: 'PAC', quantidade: 4, valor_unitario: 6.9 },
    ],
  };
  const { data, error } = await db.from('chamados').insert({
    setor_id: setor, cliente_id: cliente, contato_id: contato, titulo: `${PREFIXO} NF de venda Padaria`, resumo: 'Venda E2E', pedido_venda: pedido, origem: 'agente',
  }).select('id, numero').single();
  if (error) throw error;
  return { id: data.id as string, numero: Number(data.numero), cliente, contato, pedido };
}

type ItemConversa = { papel: 'usuario' | 'assistente'; conteudo: string; min: number; arquivo?: ReturnType<typeof CSV>; pendente?: boolean };

/** Mensagens com o assistente, "min" minutos atrás (a resposta é semeada; nenhum trabalhador roda nos e2e). */
export async function conversaComAssistente(usuarioId: string, itens: ItemConversa[], conversaId: string | null = null): Promise<string[]> {
  const agora = Date.now();
  const { data, error } = await db.from('assistente_mensagens').insert(itens.map((i) => {
    const em = new Date(agora - i.min * 60_000).toISOString();
    return { usuario_id: usuarioId, canal: 'site', conversa_id: conversaId, papel: i.papel, conteudo: i.conteudo, arquivo: i.arquivo ?? null,
      processada_em: i.pendente ? null : em, criado_em: em };
  })).select('id');
  if (error) throw error;
  return (data ?? []).map((d) => d.id as string);
}
