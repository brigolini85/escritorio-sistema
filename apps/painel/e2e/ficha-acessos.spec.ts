import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import {
  abrirFicha, acessoDeMentira, bloco, CIFRA_DE_MENTIRA, empresa, PARECE_CIFRA, SENHA, sessaoDe, vigiarRespostas,
} from './apoio-ficha';

// Parte H1 (spec 7D.1 item 8 e 7D.3): revelar senha com e sem permissão; a senha nunca aparece antes de revelar,
// nunca vai para a auditoria e nem a chave de serviço (a do trabalhador) lê a cifra.
const ADMIN = 'admin-acessos@e2e.local';
const CNPJ_TESTE = '12121212000106';
const SENHA_PORTAL = 'Portal#Segredo-2026';

test.afterAll(async () => {
  await db.from('clientes').delete().eq('cnpj', CNPJ_TESTE);
});

test('administrador cadastra o acesso: cifrado, mascarado, e revelar e copiar vão para a auditoria sem o segredo', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const id = await empresa(CNPJ_TESTE);
  const admin = await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Acessos', papel: 'admin' });
  await entrar(page, ADMIN, SENHA);
  const respostas = vigiarRespostas(page);
  await abrirFicha(page, `/clientes/${id}`);
  const acessos = bloco(page, 'Acessos de portais');
  await acessos.getByRole('button', { name: 'Adicionar acesso' }).click();
  const janela = page.getByRole('dialog', { name: 'Novo acesso de portal' });
  await janela.getByLabel('Portal').fill('SEFAZ-MG');
  await janela.getByLabel('Usuário').fill('padariasol');
  await janela.getByLabel('Senha', { exact: true }).fill(SENHA_PORTAL);
  await janela.getByRole('button', { name: 'Salvar acesso' }).click();
  await expect(janela).toHaveCount(0);
  const linha = acessos.getByRole('row', { name: /SEFAZ-MG/ });
  await expect(linha).toContainText('padariasol');
  await expect(linha.getByText('senha guardada')).toBeAttached();
  expect(await page.content()).not.toContain(SENHA_PORTAL);
  // Nem a página nem o fluxo RSC (carga e atualização depois de salvar) levam a senha ou a cifra.
  const antesDeRevelar = await respostas();
  expect(antesDeRevelar).toContain('padariasol'); // a vigia pegou a atualização depois de salvar
  expect(antesDeRevelar).not.toContain(SENHA_PORTAL);
  expect(antesDeRevelar).not.toMatch(PARECE_CIFRA);

  // Nem a chave de serviço lê a cifra (D2); portal, usuário e "tem senha" ela lê.
  const cifra = await db.from('cliente_acessos').select('senha_cifrada').eq('cliente_id', id);
  expect(cifra.error?.message ?? '').toMatch(/permission denied/);
  // Nem a sessão do próprio administrador (papel authenticated): a cifra só sai por revelar_acesso.
  const cifraLogado = await (await sessaoDe(ADMIN)).from('cliente_acessos').select('senha_cifrada').eq('cliente_id', id);
  expect(cifraLogado.error?.message ?? '').toMatch(/permission denied/);
  const { data: linhas } = await db.from('cliente_acessos').select('id, portal, usuario, tem_senha').eq('cliente_id', id);
  expect(linhas!.map(({ portal, usuario, tem_senha }) => ({ portal, usuario, tem_senha }))).toEqual([{ portal: 'SEFAZ-MG', usuario: 'padariasol', tem_senha: true }]);
  const acesso = linhas![0]!.id;

  await linha.getByRole('button', { name: 'Revelar a senha de SEFAZ-MG' }).click();
  await expect(linha.getByText(SENHA_PORTAL)).toBeVisible();
  await linha.getByRole('button', { name: 'Esconder a senha de SEFAZ-MG' }).click();
  await expect(linha.getByText(SENHA_PORTAL)).toHaveCount(0);
  await linha.getByRole('button', { name: 'Copiar a senha de SEFAZ-MG' }).click();
  await expect(page.getByText('Senha copiada.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SENHA_PORTAL);
  await expect(linha.getByText(SENHA_PORTAL)).toHaveCount(0);
  // Revelar devolve a senha aberta, nunca a cifra.
  expect(await respostas()).not.toMatch(PARECE_CIFRA);

  await expect.poll(async () => (await db.from('auditoria_acessos').select('acao, usuario_id, detalhes').eq('entidade_id', acesso).order('acao')).data
    ?.map((a) => [a.acao, a.usuario_id, (a.detalhes as { portal?: string } | null)?.portal]))
    .toEqual([['copiar_acesso', admin, 'SEFAZ-MG'], ['revelar_acesso', admin, 'SEFAZ-MG'], ['salvar_acesso', admin, 'SEFAZ-MG']]);
  // A senha e a cifra nunca entram na auditoria.
  const auditoria = JSON.stringify((await db.from('auditoria_acessos').select('detalhes')).data);
  expect(auditoria).not.toContain(SENHA_PORTAL);
  expect(auditoria).not.toContain('v1.');
});

test('sem "Ver acessos de portais": vê portal e usuário, não revela nem copia, e nada vai para a auditoria', async ({ page }) => {
  const id = await empresa(CNPJ_TESTE);
  await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Acessos', papel: 'admin' });
  const acesso = await acessoDeMentira(id, 'SEFAZ-MG', ADMIN);
  await criarUsuarioTeste({ email: 'bia-acessos@e2e.local', senha: SENHA, nome: 'Bia Acessos', papel: 'atendente', permissoes: ['editar_clientes'] });
  await entrar(page, 'bia-acessos@e2e.local', SENHA);
  const respostas = vigiarRespostas(page);
  await abrirFicha(page, `/clientes/${id}`);
  const acessos = bloco(page, 'Acessos de portais');
  const linha = acessos.getByRole('row', { name: /SEFAZ-MG/ });
  await expect(linha).toContainText('padariasol');
  await expect(linha.getByRole('button', { name: 'Revelar a senha de SEFAZ-MG' })).toBeDisabled();
  await expect(linha.getByRole('button', { name: 'Copiar a senha de SEFAZ-MG' })).toBeDisabled();
  await expect(acessos.getByText('Revelar e copiar só com a permissão "Ver acessos de portais".')).toBeVisible();
  // "Ver e editar" sozinho não cadastra, não edita e não remove (D6).
  await expect(acessos.getByRole('button', { name: 'Adicionar acesso' })).toHaveCount(0);
  await expect(linha.getByRole('button', { name: /Editar o acesso|Remover o acesso/ })).toHaveCount(0);
  // A cifra guardada não chega à página (HTML nem RSC).
  expect(await page.content()).not.toContain(CIFRA_DE_MENTIRA);
  const tudo = await respostas();
  expect(tudo).toContain('padariasol'); // a vigia pegou a página com a linha do acesso
  expect(tudo).not.toContain(CIFRA_DE_MENTIRA);
  expect(tudo).not.toMatch(PARECE_CIFRA);

  // Pelo banco, com a sessão dela, também não: nem ler a cifra, nem revelar, nem cadastrar, nem editar.
  const bia = await sessaoDe('bia-acessos@e2e.local');
  expect((await bia.from('cliente_acessos').select('senha_cifrada').eq('id', acesso)).error?.message ?? '').toMatch(/permission denied/);
  expect((await bia.rpc('revelar_acesso', { p_id: acesso, p_acao: 'revelar' })).error?.message).toMatch(/Sem permissão/);
  expect((await bia.rpc('revelar_acesso', { p_id: acesso, p_acao: 'copiar' })).error?.message).toMatch(/Sem permissão/);
  expect((await bia.rpc('salvar_acesso', {
    p_id: null, p_cliente: id, p_portal: 'e-CAC', p_usuario: null, p_senha_cifrada: CIFRA_DE_MENTIRA,
  })).error?.message).toMatch(/Sem permissão/);
  expect((await bia.rpc('salvar_acesso', {
    p_id: acesso, p_cliente: id, p_portal: 'SEFAZ-MG', p_usuario: 'outro', p_senha_cifrada: CIFRA_DE_MENTIRA,
  })).error?.message).toMatch(/Sem permissão/);
  expect((await bia.rpc('remover_acesso', { p_id: acesso })).error?.message).toMatch(/Sem permissão/);
  expect((await db.from('cliente_acessos').select('portal, usuario').eq('cliente_id', id)).data).toEqual([{ portal: 'SEFAZ-MG', usuario: 'padariasol' }]);
  expect((await db.from('auditoria_acessos').select('acao').eq('entidade_id', acesso).neq('acao', 'salvar_acesso')).data).toEqual([]);
});

test('o administrador dá "Ver acessos de portais" na ficha da pessoa e ela passa a revelar', async ({ page, context }) => {
  const id = await empresa(CNPJ_TESTE);
  await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Acessos', papel: 'admin' });
  const ze = await criarUsuarioTeste({ email: 'ze-acessos@e2e.local', senha: SENHA, nome: 'Zé Acessos', papel: 'atendente' });
  await entrar(page, ADMIN, SENHA);
  // Acesso com senha de verdade (cifrada pelo painel), cadastrado pela tela.
  await abrirFicha(page, `/clientes/${id}`);
  await bloco(page, 'Acessos de portais').getByRole('button', { name: 'Adicionar acesso' }).click();
  const janela = page.getByRole('dialog', { name: 'Novo acesso de portal' });
  await janela.getByLabel('Portal').fill('Prefeitura (NFS-e)');
  await janela.getByLabel('Senha', { exact: true }).fill(SENHA_PORTAL);
  await janela.getByRole('button', { name: 'Salvar acesso' }).click();
  await expect(janela).toHaveCount(0);
  await page.goto(`/usuarios/${ze}`);
  const chave = page.getByRole('switch', { name: 'Ver acessos de portais' });
  await expect(chave).not.toBeChecked();
  await chave.click();
  await expect(page.getByText('Zé Acessos agora vê os acessos de portais.')).toBeVisible();
  await expect.poll(async () => (await db.from('usuarios').select('ver_acessos_portais').eq('id', ze).single()).data?.ver_acessos_portais).toBe(true);

  await context.clearCookies();
  await entrar(page, 'ze-acessos@e2e.local', SENHA);
  await abrirFicha(page, `/clientes/${id}`);
  const linha = bloco(page, 'Acessos de portais').getByRole('row', { name: /Prefeitura/ });
  await linha.getByRole('button', { name: 'Revelar a senha de Prefeitura (NFS-e)' }).click();
  await expect(linha.getByText(SENHA_PORTAL)).toBeVisible();
  const { data: acesso } = await db.from('cliente_acessos').select('id').eq('cliente_id', id).single();
  await expect.poll(async () => (await db.from('auditoria_acessos').select('acao, usuario_id').eq('entidade_id', acesso!.id).eq('acao', 'revelar_acesso')).data)
    .toEqual([{ acao: 'revelar_acesso', usuario_id: ze }]);
});
