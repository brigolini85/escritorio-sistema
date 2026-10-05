import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { expect, test } from '@playwright/test';
import { limparBanco } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA, abrirAgente, criarDono, skillNoBanco } from './apoio-agentes';

// Parte I1 (spec 7E.3, D7–D10): subir, ligar, versões e restaurar; só o dono.
test.beforeEach(async () => { await limparBanco(); });
const md = (texto: string, tipo = '') => `---\nname: nunca-prometer-prazo\ndescription: O que nunca prometer.${tipo ? `\ntipo: ${tipo}` : ''}\n---\n# Nunca promete prazo\n${texto}`;
const arquivo = (name: string, conteudo: string | Uint8Array) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(conteudo) });
const skill = async () => (await db.from('agente_skills').select('ativo, versao_atual').eq('nome', 'nunca-prometer-prazo').single()).data;

test('.md sem tipo: escolhe Limites, liga, sobe versão 2, vê a diferença e restaura', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', 'skills');
  const subir = page.getByRole('region', { name: 'Subir skill' });
  await subir.getByLabel('Escolher .zip ou .md').setInputFiles(arquivo('limite.md', md('Nunca prometa prazo de emissão.')));
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(subir.getByRole('alert')).toContainText('não diz o tipo');
  await subir.getByRole('radio', { name: 'Limites' }).click();
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(page.getByText('Skill Nunca promete prazo subida (desligada).')).toBeVisible();
  await page.getByRole('switch', { name: 'Ligar Nunca promete prazo' }).click();
  await expect.poll(async () => (await skill())!.ativo).toBe(true);
  await subir.getByLabel('Escolher .zip ou .md').setInputFiles(arquivo('limite.md', md('Nunca prometa prazo nenhum.', 'limites')));
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(page.getByText('Skill Nunca promete prazo: versão 2.')).toBeVisible();
  await page.getByRole('button', { name: 'Versões de Nunca promete prazo' }).click();
  const diferenca = page.getByRole('region', { name: 'Diferença da versão 2' });
  await expect(diferenca).toContainText('Removido: Nunca prometa prazo de emissão.');
  await expect(diferenca).toContainText('Adicionado: Nunca prometa prazo nenhum.');
  await page.getByRole('button', { name: /^v1/ }).click();
  await page.getByRole('button', { name: 'Restaurar a versão 1' }).click();
  await expect.poll(async () => (await skill())!.versao_atual).toBe(3);
});

test('.zip com pasta e referência; PDF recusado', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', 'skills');
  const subir = page.getByRole('region', { name: 'Subir skill' });
  const cfop = '---\nname: tabela-cfop\ndescription: CFOPs.\ntipo: conhecimento\n---\n# Tabela CFOP\nVeja cfop.csv.';
  await subir.getByLabel('Escolher .zip ou .md').setInputFiles(arquivo('cfop.zip', zipSync({ 'tabela-cfop/SKILL.md': strToU8(cfop), 'tabela-cfop/cfop.csv': strToU8('5102;Venda') })));
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(page.getByRole('list', { name: 'Arquivos de Tabela CFOP' })).toContainText('cfop.csv');
  await subir.getByLabel('Escolher .zip ou .md').setInputFiles(arquivo('pdf.zip', zipSync({ 'SKILL.md': strToU8(cfop), 'guia.pdf': strToU8('%PDF') })));
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(subir.getByRole('alert')).toHaveText('PDF ainda não entra nas skills: mande o texto em .md, .txt ou .csv (PDF chega com as tarefas de trabalho).');
});

test('pasta com subpasta: a referência guarda o caminho relativo', async ({ page }) => {
  await criarDono();
  const pasta = join(mkdtempSync(join(tmpdir(), 'skill-e2e-')), 'tabela-icms');
  mkdirSync(join(pasta, 'refs'), { recursive: true });
  writeFileSync(join(pasta, 'SKILL.md'), '---\nname: tabela-icms\ndescription: Alíquotas.\ntipo: conhecimento\n---\n# Tabela ICMS\nVeja refs/aliquotas.csv.');
  writeFileSync(join(pasta, 'refs', 'aliquotas.csv'), 'MG;18');
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', 'skills');
  const subir = page.getByRole('region', { name: 'Subir skill' });
  const entrada = subir.getByLabel('Escolher pasta');
  await expect(entrada).toHaveAttribute('webkitdirectory', '');
  await entrada.setInputFiles(pasta);
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(page.getByRole('list', { name: 'Arquivos de Tabela ICMS' })).toContainText('refs/aliquotas.csv');
});

test('quem treina vê as skills, mas não sobe nem liga', async ({ page }) => {
  await criarDono();
  await criarUsuarioTeste({ email: 'ana@agentes.local', senha: SENHA, nome: 'Ana Treina', papel: 'atendente', permissoes: ['treinar_agente'] });
  await skillNoBanco('atendimento', { nome: 'tom', tipo: 'jeito', titulo: 'Tom do escritório', corpo: 'Curto.', ativo: true });
  await entrar(page, 'ana@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', 'skills');
  await expect(page.getByText('Tom do escritório')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Ligar Tom do escritório' })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Subir skill' })).toHaveCount(0);
});
