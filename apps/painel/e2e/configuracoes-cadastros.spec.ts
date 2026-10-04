import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirSecao } from './apoio-configuracoes';

const SENHA = 'senha-forte-123';

test('Cargos: lista nova aparece na ficha da pessoa', async ({ page }) => {
  const antes = (await db.from('configuracoes').select('cargos').eq('id', 1).single()).data!.cargos;
  await criarUsuarioTeste({ email: 'admin-cargos@e2e.local', senha: SENHA, nome: 'Admin Cargos', papel: 'admin' });
  try {
    await entrar(page, 'admin-cargos@e2e.local', SENHA);
    await abrirSecao(page, 'cargos');
    const cartao = page.getByRole('region', { name: 'Cargos' });
    await cartao.getByLabel('Cargos (um por linha)').fill('Auxiliar\nAnalista\nEstagiário e2e', { timeout: 30_000 });
    await cartao.getByRole('button', { name: 'Salvar cargos' }).click();
    await expect(page.getByText('Cargos salvos.')).toBeVisible();
    await page.goto('/usuarios/novo');
    await expect(page.locator('datalist option[value="Estagiário e2e"]')).toHaveCount(1, { timeout: 30_000 });
    // Repetido: o erro aparece e o digitado fica.
    await abrirSecao(page, 'cargos');
    await cartao.getByLabel('Cargos (um por linha)').fill('Analista\nanalista', { timeout: 30_000 });
    await cartao.getByRole('button', { name: 'Salvar cargos' }).click();
    await expect(cartao.getByRole('alert')).toHaveText('Há cargo repetido na lista.');
    await expect(cartao.getByLabel('Cargos (um por linha)')).toHaveValue('Analista\nanalista');
  } finally {
    await db.from('configuracoes').update({ cargos: antes }).eq('id', 1);
  }
});

test('Setores: renomear com Descartar e Salvar da linha', async ({ page }) => {
  await db.from('setores').delete().in('nome', ['Setor e2e G1', 'Setor e2e G1 novo']);
  await db.from('setores').insert({ nome: 'Setor e2e G1' });
  await criarUsuarioTeste({ email: 'admin-setor@e2e.local', senha: SENHA, nome: 'Admin Setor', papel: 'admin' });
  try {
    await entrar(page, 'admin-setor@e2e.local', SENHA);
    await abrirSecao(page, 'setores');
    const linha = page.getByRole('form', { name: 'Setor Setor e2e G1' });
    const nome = linha.getByLabel('Nome do setor Setor e2e G1');
    await nome.fill('Setor e2e G1 novo', { timeout: 30_000 });
    await expect(linha.getByText('Não salvo')).toBeVisible();
    await linha.getByRole('button', { name: 'Descartar alterações do setor Setor e2e G1' }).click();
    await expect(nome).toHaveValue('Setor e2e G1');
    await nome.fill('Setor e2e G1 novo');
    await linha.getByRole('button', { name: 'Salvar setor Setor e2e G1' }).click();
    await expect(page.getByText('Setor salvo.')).toBeVisible();
    await expect.poll(async () => (await db.from('setores').select('id').eq('nome', 'Setor e2e G1 novo')).data?.length).toBe(1);
  } finally {
    await db.from('setores').delete().in('nome', ['Setor e2e G1', 'Setor e2e G1 novo']);
  }
});

// Task 4: o <select> salvo sem recarregar não pode continuar âmbar (defaultSelected fixado por fixarComoSalvo).
test('Serviços: trocar o setor pelo select e salvar; o campo deixa de ficar âmbar', async ({ page }) => {
  await db.from('servicos').delete().eq('nome', 'Serviço e2e G1');
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: s } = await db.from('servicos').insert({ nome: 'Serviço e2e G1' }).select('id').single();
  await criarUsuarioTeste({ email: 'admin-servico@e2e.local', senha: SENHA, nome: 'Admin Serviço', papel: 'admin' });
  try {
    await entrar(page, 'admin-servico@e2e.local', SENHA);
    await abrirSecao(page, 'servicos');
    const linha = page.getByRole('form', { name: 'Serviço Serviço e2e G1' });
    const setor = linha.getByLabel('Setor do serviço Serviço e2e G1');
    await setor.selectOption({ label: 'Fiscal' }, { timeout: 30_000 });
    await expect(setor).toHaveAttribute('data-alterado', '');
    await linha.getByRole('button', { name: 'Salvar serviço Serviço e2e G1' }).click();
    await expect(page.getByText('Serviço salvo.')).toBeVisible();
    await expect.poll(async () => (await db.from('servicos').select('setor_id').eq('id', s!.id).single()).data?.setor_id).toBe(fiscal!.id);
    await expect(setor).not.toHaveAttribute('data-alterado');
    await expect(setor).toHaveValue(fiscal!.id);
    await expect(linha.getByText('Não salvo')).toHaveCount(0);
    await expect(linha.getByRole('button', { name: 'Descartar alterações do serviço Serviço e2e G1' })).toBeDisabled();
  } finally {
    await db.from('servicos').delete().eq('nome', 'Serviço e2e G1');
  }
});
