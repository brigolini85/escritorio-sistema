import 'server-only';
import {
  AGENTE_ATENDIMENTO_ID, ESTADOS_AGENTE, FERRAMENTAS_ATENDIMENTO, MODOS_CONTATO, SLUG_ATENDIMENTO, TIPOS_AGENTE, TIPOS_SKILL,
  type EstadoAgente, type ModoContato, type TipoAgente, type TipoSkill,
} from '@escritorio/core';
import { lerEmPaginas } from '@/lib/paginas';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import type { supabaseServidor } from '@/lib/supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/** Banco sem a Parte I (homologação, D23): tabela, coluna ou função que não existem. Só leitura GET ou rpc, nunca head. */
export function semMigracaoI1(e: { code?: string } | null | undefined): boolean {
  return !!e && ['42703', '42P01', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205'].includes(e.code ?? '');
}

export type Agente = {
  id: string; slug: string; nome: string; descricao: string; setorId: string | null; setor: string | null; tipos: TipoAgente[];
  estado: EstadoAgente; modelo: string | null; modoContato: ModoContato | null; ferramentas: string[]; portaDeEntrada: boolean;
  criadoEm: string; atualizadoEm: string; atualizadoPor: string | null;
};
type LinhaAgente = {
  id: string; slug: string; nome: string; descricao: string; setor_id: string | null; tipos: string[]; estado: string; modelo: string | null;
  modo_contato: string | null; ferramentas: string[]; porta_de_entrada: boolean; criado_em: string; atualizado_em: string;
  setores?: { nome: string } | null; atualizador?: { nome: string } | null;
};
export const COLUNAS_AGENTE = 'id, slug, nome, descricao, setor_id, tipos, estado, modelo, modo_contato, ferramentas, porta_de_entrada, criado_em, atualizado_em, setores(nome), atualizador:usuarios!agentes_atualizado_por_fkey(nome)';

const de = <T extends string>(lista: readonly T[], v: unknown): v is T => (lista as readonly unknown[]).includes(v);

/** Linha do banco → Agente; valor que não se reconhece vira o mais seguro (desligado, sem modo). */
export function lerLinhaAgente(l: LinhaAgente): Agente {
  const tipos = (l.tipos ?? []).filter((t): t is TipoAgente => de(TIPOS_AGENTE, t));
  return {
    id: l.id, slug: l.slug, nome: l.nome, descricao: l.descricao ?? '', setorId: l.setor_id, setor: l.setores?.nome ?? null,
    tipos: tipos.length ? tipos : ['conversa'], estado: de(ESTADOS_AGENTE, l.estado) ? l.estado : 'desligado', modelo: l.modelo,
    modoContato: de(MODOS_CONTATO, l.modo_contato) ? l.modo_contato : null, ferramentas: l.ferramentas ?? [], portaDeEntrada: l.porta_de_entrada === true,
    criadoEm: l.criado_em, atualizadoEm: l.atualizado_em, atualizadoPor: l.atualizador?.nome ?? null,
  };
}

/** O Thiago sem o banco novo (D23): o bastante para a lista e para as abas Orientações e Testar. */
export const THIAGO_SEM_MIGRACAO: Agente = {
  id: AGENTE_ATENDIMENTO_ID, slug: SLUG_ATENDIMENTO, nome: 'Thiago', descricao: 'porta de entrada no WhatsApp', setorId: null, setor: null,
  tipos: ['conversa'], estado: 'ligado', modelo: null, modoContato: 'mesma_voz', ferramentas: [...FERRAMENTAS_ATENDIMENTO], portaDeEntrada: true,
  criadoEm: '', atualizadoEm: '', atualizadoPor: null,
};

export async function lerAgentes(sb: Sb): Promise<{ agentes: Agente[]; semMigracao: boolean; erro: boolean }> {
  const { data, error } = await sb.from('agentes').select(COLUNAS_AGENTE).order('ordem');
  if (semMigracaoI1(error)) return { agentes: [THIAGO_SEM_MIGRACAO], semMigracao: true, erro: false };
  if (error) {
    console.error('[agentes] falha ao ler os agentes', error);
    return { agentes: [], semMigracao: false, erro: true };
  }
  return { agentes: ((data ?? []) as unknown as LinhaAgente[]).map(lerLinhaAgente), semMigracao: false, erro: false };
}

export async function lerAgente(sb: Sb, slug: string): Promise<{ agente: Agente | null; semMigracao: boolean }> {
  const { data, error } = await sb.from('agentes').select(COLUNAS_AGENTE).eq('slug', slug).maybeSingle();
  if (semMigracaoI1(error)) return { agente: slug === SLUG_ATENDIMENTO ? THIAGO_SEM_MIGRACAO : null, semMigracao: true };
  if (error) console.error('[agentes] falha ao ler o agente', slug, error);
  return { agente: data ? lerLinhaAgente(data as unknown as LinhaAgente) : null, semMigracao: false };
}

export async function souDono(sb: Sb): Promise<boolean> {
  const { data, error } = await sb.rpc('eh_dono');
  if (error) {
    if (!semMigracaoI1(error)) console.error('[agentes] falha ao conferir o dono', error);
    return false;
  }
  return data === true;
}

export type AcessoAgentes = { ver: boolean; dono: boolean; numeros: boolean };
/** D12: a tela para administrador, dono e "Treinar o agente"; números e custos para dono e administrador. */
export function acessoAosAgentes(u: Pick<UsuarioPainel, 'papel' | 'niveis'>, dono: boolean): AcessoAgentes {
  const admin = u.papel === 'admin';
  return { ver: admin || dono || temNivel(u, 'treinar', 'sim'), dono, numeros: admin || dono };
}

/** Orientações (D12): do Thiago e de agente sem setor, "Treinar o agente"; dos outros, também ser do setor (ou administrador). */
export function podeTreinarAgente(u: Pick<UsuarioPainel, 'papel' | 'niveis' | 'setores'>, a: Pick<Agente, 'portaDeEntrada' | 'setorId'>): boolean {
  if (!temNivel(u, 'treinar', 'sim')) return false;
  return a.portaDeEntrada || a.setorId === null || u.papel === 'admin' || u.setores.includes(a.setorId);
}

export type Contagens = { skills: number; ferramentas: number; orientacoes: number };
export async function lerContagens(sb: Sb, agentes: Agente[]): Promise<Map<string, Contagens>> {
  // F13: GET em páginas (o max_rows é 1000), nunca contagem head: sem a relação o head devolve 204 sem erro.
  const [skills, orientacoes] = await Promise.all([
    lerEmPaginas((de, ate) => sb.from('agente_skills').select('agente_id').is('arquivada_em', null).order('id').range(de, ate)),
    lerEmPaginas((de, ate) => sb.from('orientacoes_agente').select('agente_id').order('id').range(de, ate)),
  ]);
  if (skills.error && !semMigracaoI1(skills.error)) console.error('[agentes] contagem de skills', skills.error);
  const conta = (linhas: { agente_id: string }[], id: string) => linhas.filter((l) => l.agente_id === id).length;
  return new Map(agentes.map((a) => [a.id, {
    skills: skills.error ? 0 : conta(skills.data, a.id), ferramentas: a.ferramentas.length,
    // Sem a migração (D23) não há agente_id: as orientações são todas do Thiago.
    orientacoes: orientacoes.error ? 0 : conta(orientacoes.data, a.id),
  }]));
}

export type NumerosAgente = { atendimentos: number; resolvidos: number; custoUsd: number; custoTestesUsd: number; ultimaEm: string | null; ultimaEmpresa: string | null };
export async function lerNumeros(sb: Sb, de: string, ate: string): Promise<Map<string, NumerosAgente> | null> {
  const { data, error } = await sb.rpc('agentes_numeros', { p_de: de, p_ate: ate });
  if (error) {
    if (!semMigracaoI1(error)) console.error('[agentes] números do mês', error);
    return null;
  }
  return new Map((data ?? []).map((n) => [n.agente_id, {
    atendimentos: Number(n.atendimentos) || 0, resolvidos: Number(n.resolvidos) || 0, custoUsd: Number(n.custo_usd) || 0,
    custoTestesUsd: Number(n.custo_testes_usd) || 0, ultimaEm: n.ultima_em, ultimaEmpresa: n.ultima_empresa,
  }]));
}

export type Mudanca = { id: string; descricao: string; quem: string | null; quando: string };
export async function lerMudancas(sb: Sb, agenteId: string, limite: number): Promise<Mudanca[]> {
  const { data, error } = await sb.from('agente_mudancas').select('id, descricao, criado_em, usuarios(nome)')
    .eq('agente_id', agenteId).order('criado_em', { ascending: false }).limit(limite);
  if (error && !semMigracaoI1(error)) console.error('[agentes] mudanças', error);
  return (data ?? []).map((m) => ({ id: m.id, descricao: m.descricao, quem: m.usuarios?.nome ?? null, quando: m.criado_em }));
}

export type SkillTela = {
  id: string; nome: string; tipo: TipoSkill; ativo: boolean; versao: number; titulo: string; descricao: string; arquivos: string[];
  atualizadaEm: string; autor: string | null;
};
export async function lerSkills(sb: Sb, agenteId: string): Promise<SkillTela[]> {
  const { data: skills, error } = await sb.from('agente_skills').select('id, nome, tipo, ativo, versao_atual, atualizado_em')
    .eq('agente_id', agenteId).is('arquivada_em', null).order('nome');
  if (error) {
    if (!semMigracaoI1(error)) console.error('[agentes] skills', error);
    return [];
  }
  if (!skills?.length) return [];
  const { data: versoes } = await sb.from('agente_skill_versoes')
    .select('skill_id, versao, titulo, descricao, criado_em, usuarios(nome), agente_skill_arquivos(caminho)').in('skill_id', skills.map((s) => s.id));
  return skills.map((s) => {
    const v = (versoes ?? []).find((x) => x.skill_id === s.id && x.versao === s.versao_atual);
    return {
      id: s.id, nome: s.nome, tipo: (de(TIPOS_SKILL, s.tipo) ? s.tipo : 'conhecimento'), ativo: s.ativo, versao: s.versao_atual,
      titulo: v?.titulo ?? s.nome, descricao: v?.descricao ?? '', arquivos: (v?.agente_skill_arquivos ?? []).map((a) => a.caminho).sort(),
      atualizadaEm: v?.criado_em ?? s.atualizado_em, autor: v?.usuarios?.nome ?? null,
    };
  });
}

export type VersaoSkill = {
  id: string; versao: number; titulo: string; descricao: string; tipo: TipoSkill; corpo: string; skillMd: string; origem: 'subida' | 'restaurada';
  restauradaDe: number | null; autor: string | null; criadoEm: string; arquivos: string[];
};
export async function lerVersoesSkill(sb: Sb, skillId: string): Promise<VersaoSkill[]> {
  const { data, error } = await sb.from('agente_skill_versoes')
    .select('id, versao, titulo, descricao, tipo, corpo, skill_md, origem, restaurada_de, criado_em, usuarios(nome), agente_skill_arquivos(caminho)')
    .eq('skill_id', skillId).order('versao', { ascending: false });
  if (error) console.error('[agentes] versões da skill', error);
  return (data ?? []).map((v) => ({
    id: v.id, versao: v.versao, titulo: v.titulo, descricao: v.descricao, tipo: (de(TIPOS_SKILL, v.tipo) ? v.tipo : 'conhecimento'), corpo: v.corpo,
    skillMd: v.skill_md, origem: v.origem === 'restaurada' ? 'restaurada' : 'subida', restauradaDe: v.restaurada_de, autor: v.usuarios?.nome ?? null,
    criadoEm: v.criado_em, arquivos: (v.agente_skill_arquivos ?? []).map((a) => a.caminho).sort(),
  }));
}

export type RegraAssunto = { id: string; assunto: string; exemplo: string; modo: ModoContato };
export async function lerRegras(sb: Sb, agenteId: string): Promise<RegraAssunto[]> {
  const { data, error } = await sb.from('agente_regras_assunto').select('id, assunto, exemplo, modo').eq('agente_id', agenteId).order('criado_em');
  if (error && !semMigracaoI1(error)) console.error('[agentes] regras', error);
  return (data ?? []).filter((r) => de(MODOS_CONTATO, r.modo)).map((r) => ({ id: r.id, assunto: r.assunto, exemplo: r.exemplo, modo: r.modo as ModoContato }));
}

export type ContatoTeste = { id: string; nome: string; telefone: string };
export async function lerContatosTeste(sb: Sb, agenteId: string): Promise<ContatoTeste[]> {
  const { data, error } = await sb.from('agente_contatos_teste').select('contatos(id, nome, telefone)').eq('agente_id', agenteId);
  if (error && !semMigracaoI1(error)) console.error('[agentes] contatos em teste', error);
  return (data ?? []).flatMap((l) => (l.contatos ? [{ id: l.contatos.id, nome: l.contatos.nome, telefone: l.contatos.telefone }] : []));
}

export async function lerUsoSkills(sb: Sb, slug: string, de: string, ate: string): Promise<Map<string, number>> {
  const { data, error } = await sb.rpc('uso_skills', { p_slug: slug, p_de: de, p_ate: ate });
  if (error && !semMigracaoI1(error)) console.error('[agentes] uso das skills', error);
  return new Map((data ?? []).map((u) => [u.nome, Number(u.vezes) || 0]));
}

/** Modelos com preço (D29): o padrão de Configurações e os que têm preço em precos_modelos. */
export async function lerModelos(sb: Sb): Promise<{ padrao: string; comPreco: string[] }> {
  const { data } = await sb.from('configuracoes').select('modelo_conversa, precos_modelos').eq('id', 1).maybeSingle();
  return { padrao: data?.modelo_conversa ?? '', comPreco: Object.keys((data?.precos_modelos ?? {}) as Record<string, unknown>).sort() };
}
