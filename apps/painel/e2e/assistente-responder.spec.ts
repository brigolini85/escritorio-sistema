import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirAssistente, conversaComAssistente, criarAna, CSV, EMAIL_ANA, limparG4, semearPedido, SENHA, textoPrevia } from './apoio-assistente';

test.afterAll(limparG4);

async function retrato(chamadoId: string) {
  const [{ data: c }, { count: eventos }, { count: decisoes }] = await Promise.all([
    db.from('chamados').select('pedido_venda, resumo, titulo').eq('id', chamadoId).single(),
    db.from('chamado_eventos').select('id', { count: 'exact', head: true }).eq('chamado_id', chamadoId),
    db.from('decisoes_agente').select('id', { count: 'exact', head: true }).like('etapa', 'assistente:%'),
  ]);
  return { c, eventos, decisoes };
}

test('SIM, GRAVAR só grava a pergunta "sim" da pessoa: o pedido, os eventos e as decisões ficam iguais (D6)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  await conversaComAssistente(ana, [
    { papel: 'usuario', conteudo: `o ${p.numero} era 15 PAC`, min: 2 },
    { papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 },
  ]);
  const antes = await retrato(p.id);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const botoes = page.getByRole('group', { name: /Gravar esta prévia\?/ });
  await botoes.getByRole('button', { name: 'Sim, gravar' }).click();
  await expect(page.getByText('Pensando…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sim, gravar' })).toHaveCount(0);   // a última mensagem agora é da pessoa (D7)
  const { data: perguntas } = await db.from('assistente_mensagens').select('conteudo, papel, canal, conversa_id, processada_em')
    .eq('usuario_id', ana).eq('papel', 'usuario').order('criado_em');
  expect(perguntas?.at(-1)).toEqual({ conteudo: 'sim', papel: 'usuario', canal: 'site', conversa_id: null, processada_em: null });
  expect(perguntas).toHaveLength(2);                                                   // um clique, uma pergunta
  expect(await retrato(p.id)).toEqual(antes);
});

test('MUDAR OUTRA COISA põe o texto no campo e não envia nada', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  await conversaComAssistente(ana, [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 }]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  await page.getByRole('button', { name: 'Mudar outra coisa' }).click();
  const campo = page.getByPlaceholder('Pergunte ao assistente');
  await expect(campo).toHaveValue('Antes de gravar, mude também: ');
  await expect(campo).toBeFocused();
  // O que a pessoa já escreveu não se perde: o começo da frase vai na frente.
  await campo.fill('o bolo era 8 UN');
  await page.getByRole('button', { name: 'Mudar outra coisa' }).click();
  await expect(campo).toHaveValue('Antes de gravar, mude também: o bolo era 8 UN');
  await expect(campo).toBeFocused();
  const { count } = await db.from('assistente_mensagens').select('id', { count: 'exact', head: true }).eq('usuario_id', ana).eq('papel', 'usuario');
  expect(count).toBe(0);
});

test('sem botões: prévia já respondida, duas prévias na mesma resposta, prévia sem número, prévia já gravada (D7)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  const casos: { nome: string; itens: Parameters<typeof conversaComAssistente>[1]; nota?: boolean }[] = [
    { nome: 'respondida', itens: [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 3 }, { papel: 'usuario', conteudo: 'espera', min: 2, pendente: true }] },
    { nome: 'duas', itens: [{ papel: 'assistente', conteudo: `${textoPrevia(p.numero, '')}\n\n${textoPrevia(999999)}`, min: 1 }] },
    { nome: 'sem número', itens: [{ papel: 'assistente', conteudo: textoPrevia('').replace('#:', ':'), min: 1 }] },
    { nome: 'gravada', itens: [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 3 }], nota: true },
  ];
  await entrar(page, EMAIL_ANA, SENHA);
  for (const caso of casos) {
    await db.from('assistente_mensagens').delete().eq('usuario_id', ana);
    await db.from('chamado_eventos').delete().eq('chamado_id', p.id).eq('tipo', 'nota_interna');
    await conversaComAssistente(ana, caso.itens);
    if (caso.nota) {
      await db.from('chamado_eventos').insert({ chamado_id: p.id, tipo: 'nota_interna', usuario_id: ana,
        texto: 'Pedido alterado pelo assistente a pedido de Ana G4.', criado_em: new Date(Date.now() - 60_000).toISOString() });
    }
    await abrirAssistente(page);
    await expect(page.getByRole('region', { name: 'Resultado' })).toContainText('antes: 10 PAC');
    await expect(page.getByRole('button', { name: 'Sim, gravar' }), caso.nome).toHaveCount(0);
    if (caso.nota) await expect(page.getByRole('region', { name: 'Resultado' }).getByText(/Gravado às/)).toBeVisible();
  }
});

test('nota de gravação de OUTRA pessoa da equipe não vira selo nem esconde os botões (D5, D7)', async ({ page }) => {
  const ana = await criarAna();
  const bruno = await criarUsuarioTeste({ email: 'bruno-g4@e2e.local', senha: SENHA, nome: 'Bruno G4', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_site', 'emitir_notas'] });
  const p = await semearPedido();
  try {
    await conversaComAssistente(ana, [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 4 }]);
    const { error } = await db.from('chamado_eventos').insert({ chamado_id: p.id, tipo: 'nota_interna', usuario_id: bruno,
      texto: 'Pedido alterado pelo assistente a pedido de Bruno G4.', criado_em: new Date(Date.now() - 60_000).toISOString() });
    expect(error).toBeNull();
    await entrar(page, EMAIL_ANA, SENHA);
    await abrirAssistente(page);
    const r = page.getByRole('region', { name: 'Resultado' });
    // Espera positiva: o painel já mostra a gravação do Bruno no histórico (a nota foi lida) e os botões da prévia da Ana.
    await expect(r.getByRole('region', { name: 'Histórico do pedido' })).toContainText('Bruno G4 gravou a correção pelo assistente');
    await expect(r.getByRole('button', { name: 'Sim, gravar' })).toBeVisible();
    await expect(r.getByText(/Gravado (às|em)/)).toHaveCount(0);
  } finally {
    // Limpeza do Bruno mesmo se o teste falhar no meio (senão o usuário fica no banco para os próximos specs).
    await db.from('chamado_eventos').delete().eq('chamado_id', p.id).eq('usuario_id', bruno);
    await db.auth.admin.deleteUser(bruno);
  }
});

test('arquivo do Bling de outro dia: "gerado dd/mm HH:MM" no pedido e na aba Arquivos', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  const tresDias = 3 * 24 * 60;
  await conversaComAssistente(ana, [
    { papel: 'assistente', conteudo: 'CSV do Bling pronto.', min: tresDias, arquivo: CSV([p.id], 1, `bling-antigo-${p.numero}.csv`) },
    { papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 },
  ]);
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
    .format(new Date(Date.now() - tresDias * 60_000));
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const gerado = new RegExp(`1 pedido · gerado ${dia} [0-9]{2}:[0-9]{2}`);
  const r = page.getByRole('region', { name: 'Resultado' });
  await expect(r.getByRole('region', { name: 'Arquivo para o Bling' })).toContainText(gerado);
  await abrirAssistente(page, '?resultado=arquivos');
  await expect(r.getByRole('article', { name: 'Arquivos para o Bling' })).toContainText(gerado);
});
