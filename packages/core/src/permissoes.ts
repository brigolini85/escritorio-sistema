/**
 * Permissões por módulo com nível (spec 7.1, Parte D). A ordem de cada lista é a do banco (permissao_niveis.ordem):
 * quem tem um nível tem também os de antes dele. packages/db/test/niveis.test.ts confere que bate com o banco.
 */
export const NIVEIS = {
  atendimento: ['sem_acesso', 'meus_setores', 'todas'],
  demandas: ['minhas', 'meu_setor', 'todas'],
  clientes: ['ver', 'editar', 'arquivar'],
  precos: ['ver', 'mudar'],
  notas: ['sem_acesso', 'ver', 'corrigir'],
  assistente: ['sem_acesso', 'site', 'site_whatsapp'],
  treinar: ['nao', 'sim'],
  prazos: ['nao', 'sim'],
  configuracoes: ['nao', 'sim'],
} as const;

export type Modulo = keyof typeof NIVEIS;
export type NivelDe<M extends Modulo> = (typeof NIVEIS)[M][number];
export type Niveis = { [M in Modulo]: NivelDe<M> };

export const MODULOS = Object.keys(NIVEIS) as Modulo[];

/** O nível que reproduz o comportamento de antes da Parte D para quem não tinha marcação (igual a nivel_padrao do banco). */
export const NIVEIS_PADRAO: Niveis = {
  atendimento: 'meus_setores', demandas: 'meu_setor', clientes: 'ver', precos: 'ver', notas: 'ver',
  assistente: 'sem_acesso', treinar: 'nao', prazos: 'sim', configuracoes: 'nao',
};

export function nivelAtinge<M extends Modulo>(modulo: M, nivel: NivelDe<M>, minimo: NivelDe<M>): boolean {
  const ordem: readonly string[] = NIVEIS[modulo];
  return ordem.indexOf(nivel) >= ordem.indexOf(minimo);
}

/** Níveis lidos do banco ({modulo: nivel}): o que faltar ou vier desconhecido fica no padrão. */
export function lerNiveis(bruto: Record<string, unknown> | null | undefined): Niveis {
  const n: Record<string, string> = { ...NIVEIS_PADRAO };
  for (const m of MODULOS) {
    const v = bruto?.[m];
    if (typeof v === 'string' && (NIVEIS[m] as readonly string[]).includes(v)) n[m] = v;
  }
  return n as Niveis;
}
