'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { montarPacoteSkill, TIPOS_SKILL, type TipoSkill } from '@escritorio/core';
import type { Json } from '@escritorio/db';
import { lerVersoesSkill, souDono, type VersaoSkill } from '@/lib/agentes';
import type { ResultadoAcao } from '@/lib/agentes-acoes';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { arquivosDoFormulario } from '@/lib/pacote-skill';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

export type ResultadoSubida =
  | { ok: true; skillId: string; versao: number; nova: boolean; titulo: string }
  | { ok: false; erro: string }
  | { ok: false; precisaTipo: true; nome: string; titulo: string };

const FALHA = 'Não foi possível salvar a skill agora. Tente de novo.';
const Uuid = z.string().uuid();
const doBanco = (error: { code?: string; message: string }) => {
  if (error.code !== 'P0001') console.error('[skills] falha', error);
  return { ok: false as const, erro: error.code === 'P0001' ? mensagemDoBanco(error.message) : FALHA };
};

/** SUBIR SKILL (spec 7E.3): pasta, .zip ou .md; o tipo do cabeçalho vence o escolhido na tela; sem nenhum, pergunta (D8). */
export async function subirSkill(slug: string, formData: FormData): Promise<ResultadoSubida> {
  try {
    await obterUsuario();
    const sb = await supabaseServidor();
    if (!(await souDono(sb))) return { ok: false, erro: 'Só o dono sobe skills.' };
    const lidos = await arquivosDoFormulario(formData);
    if (!lidos.ok) return lidos;
    const tipoTela = String(formData.get('tipo') ?? '');
    const tipo = (TIPOS_SKILL as readonly string[]).includes(tipoTela) ? (tipoTela as TipoSkill) : null;
    const r = montarPacoteSkill(lidos.arquivos, tipo);
    if (!r.ok) return r;
    const { data, error } = await sb.rpc('subir_skill', { p_slug: slug, p_pacote: r.pacote as unknown as Json });
    if (error) return doBanco(error);
    revalidatePath('/agentes', 'layout');
    const d = data as { skill_id: string; versao: number; nova: boolean };
    return { ok: true, skillId: d.skill_id, versao: d.versao, nova: d.nova, titulo: r.pacote.titulo };
  } catch (e) {
    unstable_rethrow(e);
    console.error('[skills] falha ao subir', e);
    return { ok: false, erro: FALHA };
  }
}

async function chamar(rodar: (sb: Awaited<ReturnType<typeof supabaseServidor>>) => PromiseLike<{ error: { code?: string; message: string } | null }>): Promise<ResultadoAcao> {
  try {
    await obterUsuario();
    const { error } = await rodar(await supabaseServidor());
    if (error) return doBanco(error);
    revalidatePath('/agentes', 'layout');
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    console.error('[skills] falha', e);
    return { ok: false, erro: FALHA };
  }
}

export async function alternarSkill(skillId: string, ativo: boolean): Promise<ResultadoAcao> {
  if (!Uuid.safeParse(skillId).success) return { ok: false, erro: 'Skill não encontrada.' };
  return chamar((sb) => sb.rpc('alternar_skill', { p_skill: skillId, p_ativo: ativo }));
}
export async function restaurarVersaoSkill(versaoId: string): Promise<ResultadoAcao> {
  if (!Uuid.safeParse(versaoId).success) return { ok: false, erro: 'Versão não encontrada.' };
  return chamar((sb) => sb.rpc('restaurar_versao_skill', { p_versao: versaoId }));
}
export async function arquivarSkill(skillId: string): Promise<ResultadoAcao> {
  if (!Uuid.safeParse(skillId).success) return { ok: false, erro: 'Skill não encontrada.' };
  return chamar((sb) => sb.rpc('arquivar_skill', { p_skill: skillId }));
}

/** Versões para o painel de versões (D9): carregadas quando a pessoa abre. */
export async function versoesDaSkill(skillId: string): Promise<VersaoSkill[]> {
  if (!Uuid.safeParse(skillId).success) return [];
  try {
    await obterUsuario();
    return await lerVersoesSkill(await supabaseServidor(), skillId);
  } catch (e) {
    unstable_rethrow(e);
    return [];
  }
}
