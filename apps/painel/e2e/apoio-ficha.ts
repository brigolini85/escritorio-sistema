import { expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from './apoio';
import { exigirBancoLocal } from './trava-local';

/** CNPJ que o servidor falso (consultas-falsas.mjs) devolve como Padaria Sol. */
export const CNPJ_SOL = '12345678000195';
export const SENHA = 'senha-forte-123';
/** Cifra de mentira no formato do cofre (v1.<iv>.<etiqueta>.<cifra>), gravada por acessoDeMentira. */
export const CIFRA_DE_MENTIRA = 'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Zm9v';
/** Qualquer texto no formato do cofre (lib/cofre.ts, FORMATO_CIFRADO), para procurar a cifra no que o servidor manda. */
export const PARECE_CIFRA = /v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\./;

/** Abre a ficha e espera a hidratação (antes dela o Salvar fica desligado e a busca não responde, D26). */
export async function abrirFicha(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('form[data-ficha-hidratada]')).toBeVisible();
}
export const bloco = (page: Page, titulo: string) => page.getByRole('region', { name: titulo, exact: true });
export const indice = (page: Page) => page.getByRole('navigation', { name: 'Blocos da ficha' });

/** Dia em São Paulo daqui a N dias (AAAA-MM-DD). */
export function diaDaqui(n: number): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [a, m, d] = hoje.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Empresa de teste (apaga a de antes com o mesmo CNPJ; inscrições, acessos e avisos saem em cascata). */
export async function empresa(cnpj: string, extra: Record<string, unknown> = {}): Promise<string> {
  await db.from('clientes').delete().eq('cnpj', cnpj);
  const { data, error } = await db.from('clientes').insert({ razao_social: 'Ficha H1 Ltda', cnpj, ...extra }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

/** Sessão de uma pessoa pela chave pública (papel authenticated), como o navegador dela teria. */
export async function sessaoDe(email: string): Promise<SupabaseClient> {
  exigirBancoLocal(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw error;
  return sb;
}

/**
 * Acesso cadastrado pela função do banco, com a sessão de um administrador (nem a chave de serviço grava a senha, D2).
 * A cifra é de mentira, no formato certo: serve para testar quem revela, não para abrir a senha.
 */
export async function acessoDeMentira(clienteId: string, portal: string, email: string): Promise<string> {
  const sb = await sessaoDe(email);
  const { data, error } = await sb.rpc('salvar_acesso', {
    p_id: null, p_cliente: clienteId, p_portal: portal, p_usuario: 'padariasol', p_senha_cifrada: CIFRA_DE_MENTIRA,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Junta o corpo de tudo o que o servidor do painel manda à página (HTML e o fluxo RSC das navegações e ações).
 * Passa as respostas por page.route: pelo evento 'response' o Chromium às vezes já descartou o corpo do fluxo RSC
 * ("No data found for resource"), e um corpo perdido viraria vazio, deixando a conferência "sem senha" passar às cegas.
 */
export async function vigiarRespostas(page: Page): Promise<() => Promise<string>> {
  const corpos: string[] = [];
  const painel = new URL(page.url()).origin; // chamada depois de entrar: a página já está no painel
  await page.route((url) => url.origin === painel && !url.pathname.startsWith('/_next/'), async (route) => {
    const resposta = await route.fetch({ maxRedirects: 0 });
    const tipo = resposta.headers()['content-type'] ?? '';
    if (!/text\/html|text\/x-component/.test(tipo)) return route.fulfill({ response: resposta });
    const corpo = await resposta.text();
    corpos.push(corpo);
    return route.fulfill({ response: resposta, body: corpo });
  });
  return async () => corpos.join('\n');
}
