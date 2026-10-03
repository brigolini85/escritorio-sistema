import { cn } from '@/lib/cn';
import { ROTULO_PRIORIDADE, type Prioridade } from '@/lib/demandas';
import { descreverPrazo, type TomPrazo } from '@/lib/prazo';

const COR_PRIORIDADE: Record<Prioridade, string> = {
  urgente: 'font-bold text-danger',
  alta: 'font-bold text-warning',
  normal: 'text-foreground',
  baixa: 'text-muted',
};

/** Prioridade sempre escrita (spec 8: vermelho nunca sozinho). `caixaAlta`: o cartão do quadro (imagem 04). */
export function PrioridadeTexto({ prioridade, caixaAlta = false, className }: { prioridade: Prioridade; caixaAlta?: boolean; className?: string }) {
  return (
    <span className={cn(COR_PRIORIDADE[prioridade], caixaAlta && 'text-xs font-bold uppercase tracking-wide', className)}>
      {ROTULO_PRIORIDADE[prioridade]}
    </span>
  );
}

const COR_PRAZO: Record<TomPrazo, string> = {
  vencido: 'font-bold text-danger',
  hoje: 'font-bold text-warning',
  pausado: 'text-muted',
  normal: 'text-foreground',
  sem: 'text-subtle',
  'no-prazo': 'font-semibold text-success',
};

/** Prazo em texto (hoje 18h, amanhã, 13/10, venceu…, pausado). `agora` vem do servidor, para a página e o texto baterem. */
export function PrazoTexto({ prazo, pausadoDesde, concluidaEm, agora, className }: {
  prazo: string | null; pausadoDesde: string | null; concluidaEm: string | null; agora: Date; className?: string;
}) {
  const d = descreverPrazo({ prazo, pausadoDesde, concluidaEm }, agora);
  return <span className={cn('tabular', COR_PRAZO[d.tom], className)}>{d.tom === 'no-prazo' ? `✓ ${d.texto}` : d.texto}</span>;
}
