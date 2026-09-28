export type FiltroCaixa = 'todas' | 'minhas' | 'setor' | 'sem_responsavel' | 'aguardando';
export type LinhaCaixa = { id: string; atendente_id: string | null; setores_abertos: string[]; sem_responsavel: boolean; aguardando_cliente: boolean };

export const FILTROS: { valor: FiltroCaixa; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'minhas', rotulo: 'Minhas' },
  { valor: 'setor', rotulo: 'Do meu setor' },
  { valor: 'sem_responsavel', rotulo: 'Sem responsável' },
  { valor: 'aguardando', rotulo: 'Aguardando cliente' },
];

export function passaNoFiltro(l: LinhaCaixa, filtro: FiltroCaixa, u: { id: string; setores: string[] }): boolean {
  switch (filtro) {
    case 'minhas': return l.atendente_id === u.id;
    case 'setor': return l.setores_abertos.some((s) => u.setores.includes(s));
    case 'sem_responsavel': return l.sem_responsavel;
    case 'aguardando': return l.aguardando_cliente;
    default: return true;
  }
}
