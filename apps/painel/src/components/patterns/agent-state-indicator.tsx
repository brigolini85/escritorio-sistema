import { Bot, CirclePause, Gauge, UserRound } from 'lucide-react';
import { cn } from '@/lib/cn';
import { detalheEstadoAgente, tituloEstadoAgente, type EstadoAgente } from './estado-agente';

export type { EstadoAgente, MotivoPausa } from './estado-agente';
export { estadoPelaPausaGeral, MOTIVOS_PAUSA } from './estado-agente';

/**
 * Estado do agente de clientes de relance: ativo, pausado (geral, por contato, por empresa, teto de IA)
 * ou assumido por uma pessoa da equipe. Sempre cor + ícone + texto (nunca só cor).
 * Variantes: `compacto` (selo, para topo e listas) e `completo` (bloco com o motivo, para o Início e a conversa).
 */

const ESTILO = {
  ativo: { Icone: Bot, cor: 'bg-agent-active-soft text-agent-active' },
  // Neutro: sem a cor de 'ativo', porque não dá para saber se há pausa geral.
  com_agente: { Icone: Bot, cor: 'bg-surface-muted text-muted' },
  pausado: { Icone: CirclePause, cor: 'bg-agent-paused-soft text-agent-paused' },
  assumido: { Icone: UserRound, cor: 'bg-human-owned-soft text-human-owned' },
} as const;

function icone(e: EstadoAgente) {
  // Teto de IA tem ícone próprio: não é uma pausa manual, é o gasto que chegou ao limite.
  if (e.tipo === 'pausado' && e.motivo === 'teto_ia') return Gauge;
  return ESTILO[e.tipo].Icone;
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
  const { cor } = ESTILO[estado.tipo];
  const Icone = icone(estado);
  const titulo = tituloEstadoAgente(estado);
  const extra = detalheEstadoAgente(estado);

  if (variante === 'compacto') {
    return (
      <span
        title={extra ? `${titulo}: ${extra}` : titulo}
        className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2 text-xs font-medium', cor, className)}
      >
        <Icone aria-hidden size={14} strokeWidth={1.75} />
        {titulo}
        {estado.tipo === 'pausado' && extra && <span className="sr-only">: {extra}</span>}
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 rounded-lg p-3', cor, className)}>
      <Icone aria-hidden size={20} strokeWidth={1.75} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-base font-semibold">{titulo}</p>
        {extra && <p className="text-sm">{extra}</p>}
      </div>
    </div>
  );
}
