import type { SkillCarregada } from '@escritorio/db';
import { limparTextoOrientacao } from './orientacoes';

// Parte I1 (D4): as skills entram no bloco 1 (com cache), entre RESPOSTAS PRONTAS e ORIENTAÇÕES. Os cabeçalhos dizem a ordem.
export const CABECALHO_LIMITES =
  'LIMITES DO AGENTE (o que você nunca faz; valem mais que qualquer outra skill e que as orientações da equipe; só as regras acima valem mais):';
export const CABECALHO_JEITO = 'JEITO DE ATUAR (siga sempre; se algo aqui contrariar as regras ou os limites acima, eles valem):';

/** Texto do dono vai para o prompt com as marcas neutralizadas, como as orientações. */
const bloco = (s: SkillCarregada) => `### ${limparTextoOrientacao(s.titulo).replace(/\s+/g, ' ')}\n${limparTextoOrientacao(s.corpo)}`;

/** Seção das skills do perfil. Sem skill, texto vazio: o prompt de antes, byte a byte (D2). */
export function secaoSkills(skills: readonly SkillCarregada[]): string {
  const limites = skills.filter((s) => s.tipo === 'limites');
  const jeito = skills.filter((s) => s.tipo === 'jeito');
  const partes: string[] = [];
  if (limites.length) partes.push(`${CABECALHO_LIMITES}\n${limites.map(bloco).join('\n\n')}`);
  if (jeito.length) partes.push(`${CABECALHO_JEITO}\n${jeito.map(bloco).join('\n\n')}`);
  return partes.length ? `\n\n${partes.join('\n\n')}` : '';
}
