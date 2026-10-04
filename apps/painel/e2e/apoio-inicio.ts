import { expect, type Page } from '@playwright/test';
import { db } from './apoio';

/**
 * Abre o Início e espera o navegador assumir a página: o "atualizado há…" marca data-hidratado num useEffect (só roda
 * no navegador). Clicar antes disso perde o clique (mesmo cuidado do abrirSecao da G1).
 */
export async function abrirInicio(page: Page, versao: 'situacao' | 'mesa'): Promise<void> {
  await page.goto('/inicio');
  await expect(page.locator(`[data-inicio="${versao}"] [data-atualizado][data-hidratado]`)).toHaveCount(1, { timeout: 30_000 });
}

export const cartaoNumero = (page: Page, chave: string) => page.locator(`[data-numero="${chave}"]`);

/** O número grande de um cartão do Início (contrato: data-numero/data-valor, D20). */
export async function numeroInicio(page: Page, chave: string): Promise<number> {
  return Number((await cartaoNumero(page, chave).locator('[data-valor]').innerText()).trim());
}

/** Fim do dia de hoje em Brasília (UTC-3) menos 1 minuto: ainda hoje e no futuro. */
export function fimDeHoje(): string {
  const UM_DIA = 24 * 3600_000;
  const inicio = Math.floor((Date.now() - 3 * 3600_000) / UM_DIA) * UM_DIA + 3 * 3600_000;
  return new Date(inicio + UM_DIA - 60_000).toISOString();
}

/** Demanda "Com o cliente" (pausada) direto no banco: o apoio de demandas não grava prazo_pausado_desde. */
export async function demandaPausadaE2e(d: { titulo: string; setor: string; responsavelId: string; prazoEm: string }): Promise<{ id: string; numero: number }> {
  await db.from('chamados').delete().eq('titulo', d.titulo);
  const { data: s } = await db.from('setores').select('id').eq('nome', d.setor).single();
  const { data, error } = await db.from('chamados').insert({
    titulo: d.titulo, setor_id: s!.id, responsavel_id: d.responsavelId, status: 'aguardando_cliente', prazo_em: d.prazoEm,
    prazo_pausado_desde: new Date(Date.now() - 3600_000).toISOString(), origem: 'equipe',
  } as never).select('id, numero').single();
  if (error) throw error;
  return { id: data.id as string, numero: Number(data.numero) };
}
