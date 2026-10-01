import { CircleAlert, Gauge, TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { LIMITE_ORIENTACOES, type Medidor } from '@/lib/orientacoes';

const numero = (n: number) => n.toLocaleString('pt-BR');

/**
 * Medidor do espaço das orientações ligadas (spec §5): a conversa mais pesada (gerais + setor + a empresa com mais
 * texto) contra o limite de 12.000 caracteres do agente. Aviso a partir de 80%; no limite, explica o que fica de fora.
 */
export function MedidorOrientacoes({ medidor, empresa }: { medidor: Medidor; empresa: string | null }) {
  const { total, percentual, nivel } = medidor;
  const cor = nivel === 'excesso' ? 'bg-danger' : nivel === 'aviso' ? 'bg-warning' : 'bg-brand';
  return (
    <Card className="mb-4 flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Gauge aria-hidden size={16} strokeWidth={1.75} className="text-muted" />
          Espaço das orientações ligadas
        </h2>
        <p className="tabular text-sm text-muted">
          <span className="font-medium text-foreground">{numero(total)}</span> de {numero(LIMITE_ORIENTACOES)} caracteres
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Espaço usado pelas orientações ligadas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentual}
        aria-valuetext={`${numero(total)} de ${numero(LIMITE_ORIENTACOES)} caracteres`}
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className={cn('h-full rounded-full transition-all duration-150 ease-out', cor)} style={{ width: `${percentual}%` }} />
      </div>
      <p className="text-sm text-muted">
        Numa conversa o agente lê as orientações para todos, as dos setores e as da empresa da conversa.
        {empresa ? ` A conta usa a empresa com mais texto (${empresa}).` : ''}
      </p>
      {nivel === 'excesso' ? (
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>
            Chegou ao limite. O que passar de {numero(LIMITE_ORIENTACOES)} caracteres o agente não lê: as orientações para
            todos os clientes mais antigas ficam de fora primeiro. Desligue ou encurte orientações para voltar abaixo do limite.
          </span>
        </p>
      ) : nivel === 'aviso' ? (
        <p className="flex items-start gap-1.5 text-sm text-warning">
          <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>
            Perto do limite. Passando de {numero(LIMITE_ORIENTACOES)} caracteres, as orientações para todos os clientes mais
            antigas deixam de ser lidas pelo agente. Junte ou encurte orientações parecidas.
          </span>
        </p>
      ) : null}
    </Card>
  );
}
