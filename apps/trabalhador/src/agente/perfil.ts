import type Anthropic from '@anthropic-ai/sdk';
import { FERRAMENTAS_ATENDIMENTO, SLUG_ATENDIMENTO } from '@escritorio/core';
import type { Configuracoes, PerfilAgente, Repos } from '@escritorio/db';
import type { ContextoAgente } from './contexto';
import { FERRAMENTAS } from './ferramentas';

/** O Thiago como era antes da Parte I (D23): sem o banco novo, o motor monta exatamente o pedido de antes. */
export const PERFIL_PADRAO_ATENDIMENTO: PerfilAgente = {
  id: null, slug: SLUG_ATENDIMENTO, nome: 'Thiago', modelo: null, ferramentas: [...FERRAMENTAS_ATENDIMENTO], skills: [], skillEmTeste: null,
};

let avisouSemParteI = false;

/** Perfil pelo endereço. O Thiago sem a Parte I no banco usa o perfil do código; outro agente sem linha é erro. */
export async function carregarPerfil(repos: Repos, slug: string, skillEmTeste: string | null = null): Promise<PerfilAgente> {
  const perfil = await repos.perfilDoAgente(slug, skillEmTeste);
  if (perfil) return perfil;
  if (slug !== SLUG_ATENDIMENTO) throw new Error(`Agente não encontrado: ${slug}`);
  if (!avisouSemParteI) {
    avisouSemParteI = true;
    console.warn('[motor] os agentes ainda não estão no banco (Parte I): usando o Thiago do código');
  }
  return PERFIL_PADRAO_ATENDIMENTO;
}

export const perfilDoContexto = (ctx: Pick<ContextoAgente, 'agente'>): PerfilAgente => ctx.agente ?? PERFIL_PADRAO_ATENDIMENTO;
export const modeloDoPerfil = (p: PerfilAgente, config: Pick<Configuracoes, 'modeloConversa'>): string => p.modelo ?? config.modeloConversa;

/** As ferramentas liberadas no perfil, na ordem de FERRAMENTAS (o pedido do Thiago não muda). */
export function ferramentasDoPerfil(p: PerfilAgente): Anthropic.Tool[] {
  return FERRAMENTAS.filter((f) => p.ferramentas.includes(f.name));
}
