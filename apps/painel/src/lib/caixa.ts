export type FiltroCaixa = 'todas' | 'minhas' | 'setor' | 'sem_responsavel' | 'aguardando' | 'agente' | 'concluidas';
export type LinhaCaixa = {
  id: string; atendente_id: string | null; setores_abertos: string[]; sem_responsavel: boolean; aguardando_cliente: boolean;
  /** caixa_entrada.estado e caixa_entrada.chamados_abertos: usados só pelos filtros "Com o agente" e "Concluídas". */
  estado?: 'agente' | 'humano' | null; chamados_abertos?: number | null;
};

export const FILTROS: { valor: FiltroCaixa; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'minhas', rotulo: 'Minhas' },
  { valor: 'setor', rotulo: 'Do meu setor' },
  { valor: 'sem_responsavel', rotulo: 'Sem responsável' },
  { valor: 'aguardando', rotulo: 'Com o cliente' },
];

export function passaNoFiltro(l: LinhaCaixa, filtro: FiltroCaixa, u: { id: string; setores: string[] }): boolean {
  switch (filtro) {
    case 'minhas': return l.atendente_id === u.id;
    case 'setor': return l.setores_abertos.some((s) => u.setores.includes(s));
    case 'sem_responsavel': return l.sem_responsavel;
    case 'aguardando': return l.aguardando_cliente;
    case 'agente': return l.estado === 'agente' && !l.sem_responsavel;
    case 'concluidas': return l.estado === 'agente' && l.chamados_abertos === 0;
    default: return true;
  }
}

/** Administrador, "Todas as conversas" e quem não tem setor veem tudo de início; os demais começam pelo próprio setor. */
export function filtroPadrao(u: { papel: 'admin' | 'atendente'; setores: string[]; niveis?: { atendimento: string } }): FiltroCaixa {
  return u.papel === 'admin' || u.niveis?.atendimento === 'todas' || u.setores.length === 0 ? 'todas' : 'setor';
}

/**
 * Filtros rápidos da tela Atendimento (spec, seção 7), todos lidos direto da view caixa_entrada:
 * - Aguardando humano = sem_responsavel (demanda aberta sem responsável; o mesmo critério do contador do menu);
 * - Comigo = minhas (conversas que eu assumi);
 * - Com o agente = o agente conduz (estado 'agente') e nada espera a equipe;
 * - Concluídas = com o agente (ninguém assumiu) e nenhuma demanda aberta que a pessoa vê (a view é security_invoker).
 *   Inclui conversas que nunca tiveram demanda (o agente resolveu sozinho).
 * Os filtros antigos continuam valendo na URL (?filtro=) e ficam no menu "Mais".
 */
export const FILTROS_RAPIDOS: { valor: FiltroCaixa; rotulo: string }[] = [
  { valor: 'sem_responsavel', rotulo: 'Aguardando humano' },
  { valor: 'minhas', rotulo: 'Comigo' },
  { valor: 'agente', rotulo: 'Com o agente' },
  { valor: 'concluidas', rotulo: 'Concluídas' },
];

/** Os demais filtros (Todas, Do meu setor, Com o cliente), no menu "Mais". */
export const FILTROS_MAIS = FILTROS.filter((f) => !FILTROS_RAPIDOS.some((r) => r.valor === f.valor));

const VALORES_FILTRO = new Set<string>([...FILTROS, ...FILTROS_RAPIDOS].map((f) => f.valor));

/** ?filtro= da URL: um valor conhecido, senão o filtro padrão da pessoa. */
export function lerFiltroCaixa(valor: string | undefined, u: { papel: 'admin' | 'atendente'; setores: string[] }): FiltroCaixa {
  return valor && VALORES_FILTRO.has(valor) ? (valor as FiltroCaixa) : filtroPadrao(u);
}

/** Rótulo mostrado na tela (o dos filtros rápidos vale para os valores que estão nos dois). */
export function rotuloFiltroCaixa(valor: FiltroCaixa): string {
  return [...FILTROS_RAPIDOS, ...FILTROS].find((f) => f.valor === valor)?.rotulo ?? valor;
}

/** Aguardando humano no topo; dentro de cada grupo, a ordem que veio (mais recente primeiro). */
export function ordenarCaixa<T extends { sem_responsavel: boolean | null }>(linhas: T[]): T[] {
  return [...linhas.filter((l) => l.sem_responsavel), ...linhas.filter((l) => !l.sem_responsavel)];
}

/** "?filtro=…&q=…" para os links da caixa (só o que tiver valor; nada → ""). */
export function consultaCaixa(p: { filtro?: string | null; q?: string | null }): string {
  const sp = new URLSearchParams();
  if (p.filtro) sp.set('filtro', p.filtro);
  if (p.q?.trim()) sp.set('q', p.q.trim());
  const s = sp.toString();
  return s ? `?${s}` : '';
}
