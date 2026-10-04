import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirAssistente, conversaComAssistente, criarAna, CSV, EMAIL_ANA, limparG4, PREFIXO, semearPedido, SENHA, textoPrevia } from './apoio-assistente';

test.afterAll(limparG4);

test('painel do pedido: dados da prévia (não do banco), origem, "O que mudou" e total antes/depois (D2, D3)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();                                    // no banco: 10 PAC
  await conversaComAssistente(ana, [
    { papel: 'usuario', conteudo: `o ${p.numero} era 15 PAC`, min: 2 },
    { papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 },  // a prévia: 15 PAC
  ]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const r = page.getByRole('region', { name: 'Resultado' });
  await expect(r.getByRole('heading', { name: `Pedido #${p.numero} · ${PREFIXO} Padaria Sol ME` })).toBeVisible();
  await expect(r.getByText('Nota de venda · Setor Fiscal')).toBeVisible();
  for (const t of ['Rede Bom Preço', 'Unidade Centro', 'Boleto 28 dias', '03/10', 'endereço do cadastro', `${PREFIXO} Carla Mendes`]) {
    await expect(r.getByText(t, { exact: true })).toBeVisible();
  }
  await expect(r.getByText(/^WhatsApp · \d{2}\/\d{2}$/)).toBeVisible();
  const linha = r.getByRole('row').filter({ hasText: 'Pão de queijo congelado 1kg' });
  await expect(linha).toContainText('Alterado');
  await expect(linha).toContainText('15 PAC');
  await expect(linha).toContainText('antes: 10 PAC');
  await expect(linha).toContainText('antes: R$ 185,00');
  await expect(r.getByRole('row').filter({ hasText: 'Total do pedido' })).toContainText(/R\$ 389,10\s*antes: R\$ 296,60/);
  await expect(r.getByRole('link', { name: 'Abrir demanda' })).toHaveAttribute('href', `/demandas?demanda=${p.id}`);
  await expect(r.getByText(/Gravado (às|em)/)).toHaveCount(0);
  await expect(r.getByRole('region', { name: 'Arquivo para o Bling' })).toContainText('Depois de gravar, peça ao assistente o CSV do Bling deste pedido.');
  await expect(r.getByRole('region', { name: 'Histórico do pedido' })).toContainText(`Agente abriu o pedido pelo WhatsApp de ${PREFIXO} Carla Mendes`);
  await expect(r.getByRole('region', { name: 'Histórico do pedido' })).toContainText('Prévia mostrada a Ana');
});

test('depois do "sim": selo "Gravado às HH:MM por <pessoa>", arquivo do pedido e histórico (D4, D5)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  const [, , , idArquivo] = await conversaComAssistente(ana, [
    { papel: 'usuario', conteudo: `o ${p.numero} era 15 PAC, corrige e manda o CSV`, min: 5 },
    { papel: 'assistente', conteudo: textoPrevia(p.numero), min: 4 },
    { papel: 'usuario', conteudo: 'sim', min: 3 },
    { papel: 'assistente', conteudo: `Feito: pedido #${p.numero} gravado. CSV do Bling pronto.`, min: 1, arquivo: CSV([p.id], 1, `bling-pedidos-${p.numero}.csv`) },
  ]);
  // A nota que o trabalhador grava ao gravar a correção (assistente/ferramentas.ts).
  await db.from('chamado_eventos').insert({ chamado_id: p.id, cliente_id: p.cliente, tipo: 'nota_interna', usuario_id: ana,
    texto: 'Pedido alterado pelo assistente a pedido de Ana G4.\nAntes:\n…\nDepois:\n…', criado_em: new Date(Date.now() - 2 * 60_000).toISOString() });
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const r = page.getByRole('region', { name: 'Resultado' });
  await expect(r.getByRole('link', { name: `Pedido #${p.numero}` })).toHaveAttribute('aria-current', 'page');   // o pedido abre, não Arquivos (D9)
  await expect(r.getByText(/^Gravado às \d{2}:\d{2} por Ana G4$/)).toBeVisible();
  const arquivo = r.getByRole('region', { name: 'Arquivo para o Bling' });
  await expect(arquivo).toContainText(`bling-pedidos-${p.numero}.csv`);
  await expect(arquivo).toContainText('1 pedido · gerado');
  await expect(arquivo.getByRole('link', { name: 'Baixar CSV Bling' })).toHaveAttribute('href', `/api/csv-bling?assistente=${idArquivo}&parte=1`);
  const historico = r.getByRole('region', { name: 'Histórico do pedido' });
  await expect(historico).toContainText('Ana G4 gravou a correção pelo assistente');
  await expect(historico).toContainText('CSV do Bling gerado');
  // Abertura, prioridade e prazo (o gatilho da Parte C grava os três ao criar), prévia, gravação e CSV.
  await expect(historico).toContainText('6 eventos');
});

test('nota de outra pessoa não vira selo (D5)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  await conversaComAssistente(ana, [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 4 }]);
  await db.from('chamado_eventos').insert({ chamado_id: p.id, tipo: 'nota_interna', usuario_id: null,
    texto: 'Pedido alterado pelo assistente a pedido de Bruno.', criado_em: new Date(Date.now() - 60_000).toISOString() });
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  await expect(page.getByRole('region', { name: 'Resultado' }).getByText(/Gravado (às|em)/)).toHaveCount(0);
});

test('demanda fora dos setores da pessoa: a prévia continua, sem dados da demanda (D17)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido(`${PREFIXO} Outro setor`);
  await conversaComAssistente(ana, [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 }]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const r = page.getByRole('region', { name: 'Resultado' });
  await expect(r).toContainText('Esta demanda não está entre as que você vê; a prévia continua aqui.');
  await expect(r).toContainText('antes: 10 PAC');
  await expect(r).not.toContainText(`${PREFIXO} Padaria Sol ME`);
  await expect(r).not.toContainText(`${PREFIXO} Carla Mendes`);
  await expect(r.getByRole('link', { name: 'Abrir demanda' })).toHaveCount(0);
  await expect(r.getByRole('region', { name: 'Histórico do pedido' })).toHaveCount(0);
});

test('conversa aberta por ?conversa= sem mensagens da pessoa aparece nos botões do histórico (D14)', async ({ page }) => {
  const dono = await criarUsuarioTeste({ email: 'dono-g4@e2e.local', senha: SENHA, nome: 'Dono G4', papel: 'admin', permissoes: ['assistente_site'] });
  const telefones = ['5531940000201', '5531940000202', '5531940000203'];
  await db.from('conversas').delete().in('telefone', telefones);
  const ids: string[] = [];
  for (const telefone of telefones) ids.push((await db.from('conversas').insert({ telefone }).select('id').single()).data!.id as string);
  // Duas conversas com mensagens ocupam os botões; a terceira nunca teve pergunta da pessoa.
  await conversaComAssistente(dono, [{ papel: 'usuario', conteudo: 'pergunta 1', min: 5 }], ids[0]);
  await conversaComAssistente(dono, [{ papel: 'usuario', conteudo: 'pergunta 2', min: 4 }], ids[1]);
  try {
    await entrar(page, 'dono-g4@e2e.local', SENHA);
    await abrirAssistente(page, `?conversa=${ids[2]}`);
    const historico = page.getByRole('navigation', { name: 'Histórico do assistente' });
    await expect(historico.locator(`a[href="/assistente?conversa=${ids[2]}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(historico.locator(`a[href="/assistente?conversa=${ids[1]}"]`)).toBeVisible();   // a mais recente continua
    await expect(historico.getByRole('button', { name: '+1 conversas' })).toBeVisible();           // a outra foi para o "+n"
  } finally {
    await db.from('conversas').delete().in('telefone', telefones);
  }
});
