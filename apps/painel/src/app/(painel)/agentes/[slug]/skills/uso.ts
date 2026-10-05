import { INFO_TIPO_SKILL, TIPOS_SKILL, type TipoSkill } from '@escritorio/core';
import type { SkillTela } from '@/lib/agentes';

export function gruposDeSkills(skills: SkillTela[]): { tipo: TipoSkill; skills: SkillTela[] }[] {
  return [...TIPOS_SKILL].sort((a, b) => INFO_TIPO_SKILL[a].ordem - INFO_TIPO_SKILL[b].ordem)
    .map((tipo) => ({ tipo, skills: skills.filter((x) => x.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome)) }));
}

/** "Uso no mês" (D10): Jeito e Limites entram em toda conversa; as outras contam as leituras. */
export function textoDeUso(s: Pick<SkillTela, 'tipo' | 'ativo' | 'nome'>, uso: Map<string, number>): string {
  if (!s.ativo) return 'desligada';
  if (INFO_TIPO_SKILL[s.tipo].sempre) return 'em toda conversa';
  const n = uso.get(s.nome) ?? 0;
  return n ? `usada ${n}× no mês` : 'ainda não usada';
}
