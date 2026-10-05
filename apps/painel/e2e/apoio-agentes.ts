import type { Page } from '@playwright/test';
import { criarSkillTeste, marcarDonoTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste } from './apoio';

export const SENHA = 'Senha-e2e-agentes-1';

/** Administrador marcado como dono pelo SQL (a API não muda a marcação, D11). */
export async function criarDono(email = 'dono@agentes.local', nome = 'Thiago Dono'): Promise<string> {
  const id = await criarUsuarioTeste({ email, senha: SENHA, nome, papel: 'admin' });
  await marcarDonoTeste(id);
  return id;
}

export async function abrirAgente(page: Page, slug: string, aba = ''): Promise<void> {
  await page.goto(`/agentes/${slug}${aba ? `/${aba}` : ''}`);
}

/** Skill direto no banco (como se o dono tivesse subido), versão 1. Postgres direto (F10): service_role não escreve nas tabelas de skills. */
export async function skillNoBanco(slug: string, s: { nome: string; tipo: string; titulo: string; corpo: string; ativo?: boolean }): Promise<string> {
  return criarSkillTeste(slug, s.nome, s.tipo, s.ativo ?? false, [], { titulo: s.titulo, descricao: `Quando ${s.nome}.`, corpo: s.corpo });
}
