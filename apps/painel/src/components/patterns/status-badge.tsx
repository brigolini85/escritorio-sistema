import { Bot, CircleCheck, CircleDashed, CircleDot, Clock, Headset, UserRound, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';

/**
 * Status de demanda e de conversa: cor + ícone + texto (nunca só cor).
 * Demanda: status_chamado do banco. Conversa: estado_conversa, com "aguardando atendente" quando há demanda sem responsável.
 */

export type StatusDemanda = 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'concluido';
export type StatusConversa = 'agente' | 'humano' | 'aguardando_atendente';

type Aparencia = { rotulo: string; Icone: LucideIcon; variant: NonNullable<BadgeProps['variant']> };

export const STATUS_DEMANDA: Record<StatusDemanda, Aparencia> = {
  aberto: { rotulo: 'Aberta', Icone: CircleDot, variant: 'info' },
  em_andamento: { rotulo: 'Em andamento', Icone: CircleDashed, variant: 'brand' },
  aguardando_cliente: { rotulo: 'Aguardando cliente', Icone: Clock, variant: 'warning' },
  concluido: { rotulo: 'Concluída', Icone: CircleCheck, variant: 'success' },
};

export const STATUS_CONVERSA: Record<StatusConversa, Aparencia> = {
  agente: { rotulo: 'Com o agente', Icone: Bot, variant: 'agent-active' },
  humano: { rotulo: 'Com atendente', Icone: UserRound, variant: 'human-owned' },
  aguardando_atendente: { rotulo: 'Aguardando atendente', Icone: Headset, variant: 'warning' },
};

export function StatusBadge(
  props: ({ tipo: 'demanda'; status: StatusDemanda } | { tipo: 'conversa'; status: StatusConversa }) & { className?: string },
) {
  const a = props.tipo === 'demanda' ? STATUS_DEMANDA[props.status] : STATUS_CONVERSA[props.status];
  if (!a) return null;
  const { Icone } = a;
  return (
    <Badge variant={a.variant} className={props.className}>
      <Icone aria-hidden strokeWidth={1.75} />
      {a.rotulo}
    </Badge>
  );
}
