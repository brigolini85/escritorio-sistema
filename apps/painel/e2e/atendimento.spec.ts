import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

async function conversaComChamado(telefone: string, setor: string, texto: string) {
  await db.from('conversas').delete().eq('telefone', telefone);
  const { data: conversa } = await db.from('conversas').insert({ telefone }).select().single();
  await db.from('mensagens').insert({ conversa_id: conversa!.id, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: texto });
  const { data: s } = await db.from('setores').select('id').eq('nome', setor).single();
  await db.from('chamados').insert({ conversa_id: conversa!.id, setor_id: s!.id, titulo: texto });
  return conversa!.id;
}

test('atendente do Fiscal assume, responde e não vê conversa do Pessoal', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: 'senha-forte-123', nome: 'Ana', papel: 'atendente', setores: ['Fiscal'] });
  const fiscal = await conversaComChamado('5531999990101', 'Fiscal', 'Preciso da guia do DAS');
  await conversaComChamado('5531999990102', 'Pessoal', 'Holerite do João');

  await entrar(page, 'ana@teste.com', 'senha-forte-123');
  await page.goto('/atendimento?filtro=todas');
  await expect(page.getByText('Preciso da guia do DAS')).toBeVisible();
  await expect(page.getByText('Holerite do João')).toHaveCount(0);

  await page.goto(`/atendimento/${fiscal}`);
  await page.getByRole('button', { name: 'Assumir' }).click();
  await expect(page.getByRole('button', { name: 'Devolver ao agente' })).toBeVisible();
  await page.getByPlaceholder('Escreva a resposta para o cliente').fill('Segue a guia em anexo.');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Segue a guia em anexo.')).toBeVisible();

  const { data } = await db.from('mensagens').select('status_envio, autor').eq('conversa_id', fiscal).eq('direcao', 'saida').single();
  expect(data).toEqual({ status_envio: 'pendente', autor: 'atendente' });
});
