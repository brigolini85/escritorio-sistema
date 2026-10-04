import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import {
  abrirAssistente, conversaComAssistente, criarAna, CSV, EMAIL_ANA, limparG4, semearPedido, SENHA, TEXTO_TABELA, textoPrevia,
} from './apoio-assistente';

test.afterAll(limparG4);

test('menu recolhido e histórico em botões: Geral, as 2 conversas mais recentes e "+n" (D13, D14)', async ({ page }) => {
  const dono = await criarUsuarioTeste({ email: 'dono-g4@e2e.local', senha: SENHA, nome: 'Dono G4', papel: 'admin', permissoes: ['assistente_site'] });
  const telefones = ['5531940000101', '5531940000102', '5531940000103'];
  await db.from('conversas').delete().in('telefone', telefones);
  const ids: string[] = [];
  for (const [i, telefone] of telefones.entries()) {
    const { data: c } = await db.from('conversas').insert({ telefone }).select('id').single();
    ids.push(c!.id);
    await conversaComAssistente(dono, [{ papel: 'usuario', conteudo: `pergunta ${i}`, min: 30 - i }], c!.id);
  }
  try {
    await entrar(page, 'dono-g4@e2e.local', SENHA);
    await abrirAssistente(page);
    await expect(page.locator('[data-recolhido]')).toHaveCount(1);
    const historico = page.getByRole('navigation', { name: 'Histórico do assistente' });
    await expect(historico.getByRole('link', { name: 'Geral' })).toHaveAttribute('aria-current', 'page');
    await expect(historico.getByRole('link')).toHaveCount(3);                       // Geral + as 2 mais recentes
    await historico.getByRole('button', { name: '+1 conversas' }).click();
    await page.getByRole('menuitem').click();                                        // a mais antiga, no "+n"
    await expect(page).toHaveURL(new RegExp(`conversa=${ids[0]}`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Assistente ·');
    await expect(page.getByRole('link', { name: 'Abrir no Atendimento' })).toBeVisible();
  } finally {
    await db.from('conversas').delete().in('telefone', telefones);
  }
});

test('tabela e prévia saem do balão e abrem ao lado, com abas (D8, D9)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  await conversaComAssistente(ana, [
    { papel: 'usuario', conteudo: 'quais pedidos de nota estão em aberto?', min: 9 },
    { papel: 'assistente', conteudo: TEXTO_TABELA, min: 8 },
    { papel: 'usuario', conteudo: `o pedido ${p.numero} era 15 PAC, corrige e me manda o CSV`, min: 2 },
    { papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 },
  ]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);

  const conversa = page.getByTestId('mensagens-assistente');
  await expect(conversa.getByText(`Prévia #${p.numero} · 1 alteração`)).toBeVisible();
  await expect(conversa.getByText('Tabela · 4 linhas')).toBeVisible();
  await expect(conversa).not.toContainText('R$ 277,50');                          // a prévia não está no balão
  await expect(conversa).not.toContainText('Mercado Central');                    // nem a tabela

  const resultado = page.getByRole('region', { name: 'Resultado' });
  const abas = resultado.getByRole('navigation', { name: 'Resultados desta conversa' });
  await expect(abas.getByRole('link', { name: `Pedido #${p.numero}` })).toHaveAttribute('aria-current', 'page');
  await expect(abas.getByRole('link', { name: /Pedidos em aberto/ })).toBeVisible();
  await expect(resultado).toContainText('antes: 10 PAC');                           // o pedido aberto por padrão

  await conversa.getByRole('link', { name: 'Ver ao lado: Tabela · 4 linhas' }).click();
  await expect(page).toHaveURL(/resultado=tabela-/);
  await expect(resultado.getByRole('heading', { name: 'Pedidos em aberto' })).toBeVisible();
  await expect(resultado.getByRole('row')).toHaveCount(5);                          // cabeçalho + 4
  await expect(abas.getByRole('link', { name: /Pedidos em aberto/ })).toHaveAttribute('aria-current', 'page');
});

test('arquivo: cartão na conversa com os links de hoje e aba Arquivos (n) ao lado; sem "Corrigir e gerar", nada (D12)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  const [, id] = await conversaComAssistente(ana, [
    { papel: 'usuario', conteudo: 'gera o CSV', min: 3 },
    { papel: 'assistente', conteudo: 'Pronto, gerei o CSV.', min: 2, arquivo: CSV([p.id], 2) },
  ]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const conversa = page.getByTestId('mensagens-assistente');
  await expect(conversa.getByRole('link', { name: 'Baixar CSV Bling (parte 1)' })).toHaveAttribute('href', `/api/csv-bling?assistente=${id}&parte=1`);
  const resultado = page.getByRole('region', { name: 'Resultado' });
  await expect(resultado.getByRole('link', { name: 'Arquivos (1)' })).toHaveAttribute('aria-current', 'page');
  await expect(resultado.getByRole('link', { name: 'Baixar CSV Bling · parte 2 de 2' })).toHaveAttribute('href', `/api/csv-bling?assistente=${id}&parte=2`);

  await criarAna(['assistente_site']);
  const ana2 = (await db.from('usuarios').select('id').eq('email', EMAIL_ANA).single()).data!.id as string;
  await conversaComAssistente(ana2, [{ papel: 'assistente', conteudo: 'Pronto, gerei o CSV.', min: 2, arquivo: CSV([p.id]) }]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  await expect(page.getByRole('link', { name: /CSV Bling/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Arquivos/ })).toHaveCount(0);
});

test('sem resultados: o lado diz onde aparecem; sugestões sempre acima do campo e só preenchem (D15)', async ({ page }) => {
  await criarAna();
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  await expect(page.getByRole('region', { name: 'Resultado' }).getByText('Os resultados aparecem aqui')).toBeVisible();
  await page.getByRole('list', { name: 'Sugestões de perguntas' }).getByRole('button').first().click();
  await expect(page.getByPlaceholder('Pergunte ao assistente')).not.toHaveValue('');
  await expect(page.getByText('Pensando…')).toHaveCount(0);
});
