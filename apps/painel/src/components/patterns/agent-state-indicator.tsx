import { Bot, CirclePause, UserRound } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Estado do agente de IA de relance: ativo, pausado (com motivo opcional: geral, contato, empresa, teto de IA)
 * ou assumido por uma pessoa da equipe. Sempre cor + ícone + texto.
 * Versão mínima da fase 2 (barra do topo); a fase 3 estende para lista e conversa.
 */
export type EstadoAgente =
  | { tipo: 'ativo' }
  | { tipo: 'pausado'; motivo?: string }
  | { tipo: 'assumido'; por: string };

const ESTILO = {
  ativo: { Icone: Bot, cor: 'bg-agent-active-soft text-agent-active' },
  pausado: { Icone: CirclePause, cor: 'bg-agent-paused-soft text-agent-paused' },
  assumido: { Icone: UserRound, cor: 'bg-human-owned-soft text-human-owned' },
} as const;

function titulo(e: EstadoAgente): string {
  if (e.tipo === 'ativo') return 'Agente ativo';
  if (e.tipo === 'pausado') return 'Agente pausado';
  return `Assumida por ${e.por}`;
}

function detalhe(e: EstadoAgente): string | null {
  if (e.tipo === 'ativo') return 'Respondendo aos clientes';
  if (e.tipo === 'pausado') return e.motivo ?? null;
  return 'O agente não responde nesta conversa';
}

export function AgentStateIndicator({
  estado,
  variante = 'compacto',
  className,
}: {
  estado: EstadoAgente;
  variante?: 'compacto' | 'completo';
  className?: string;
}) {
  const { Icone, cor } = ESTILO[estado.tipo];
  const extra = detalhe(estado);

  if (variante === 'compacto') {
    return (
      <span
        title={extra ? `${titulo(estado)}: ${extra}` : titulo(estado)}
        className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2 text-xs font-medium', cor, className)}
      >
        <Icone aria-hidden size={14} strokeWidth={1.75} />
        {titulo(estado)}
        {estado.tipo === 'pausado' && estado.motivo && <span className="sr-only">: {estado.motivo}</span>}
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 rounded-lg p-3', cor, className)}>
      <Icone aria-hidden size={20} strokeWidth={1.75} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-base font-semibold">{titulo(estado)}</p>
        {extra && <p className="text-sm">{extra}</p>}
      </div>
    </div>
  );
}
