import { Bot, CircleCheck, CircleDashed, CircleDot, Clock, Headset, MessageCircleHeart, ScrollText, Signpost, UserRound, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { ROTULO_TIPO, type TipoOrientacao } from '@/lib/orientacoes';

/**
 * Status de demanda e de conversa: cor + ícone + texto (nunca só cor).
 * Demanda: status_chamado do banco. Conversa: estado_conversa, com "aguardando atendente" quando há demanda sem responsável.
 * Orientação: o tipo de uma orientação do agente (tela Treinar o agente).
 */

export type StatusDemanda = 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'concluido';
export type StatusConversa = 'agente' | 'humano' | 'aguardando_atendente';
export type TipoOrientacaoSelo = TipoOrientacao;

type Aparencia = { rotulo: string; Icone: LucideIcon; variant: NonNullable<BadgeProps['variant']>; cor: string };

export const STATUS_DEMANDA: Record<StatusDemanda, Aparencia> = {
  aberto: { rotulo: 'Nova', Icone: CircleDot, variant: 'info', cor: 'text-info' },
  em_andamento: { rotulo: 'Resolvendo', Icone: CircleDashed, variant: 'brand', cor: 'text-brand' },
  aguardando_cliente: { rotulo: 'Com o cliente', Icone: Clock, variant: 'warning', cor: 'text-warning' },
  concluido: { rotulo: 'Concluída', Icone: CircleCheck, variant: 'success', cor: 'text-success' },
};

export const STATUS_CONVERSA: Record<StatusConversa, Aparencia> = {
  agente: { rotulo: 'Com o agente', Icone: Bot, variant: 'agent-active', cor: 'text-agent-active' },
  humano: { rotulo: 'Com atendente', Icone: UserRound, variant: 'human-owned', cor: 'text-human-owned' },
  aguardando_atendente: { rotulo: 'Aguardando atendente', Icone: Headset, variant: 'warning', cor: 'text-warning' },
};

export const TIPO_ORIENTACAO: Record<TipoOrientacaoSelo, Aparencia> = {
  jeito: { rotulo: ROTULO_TIPO.jeito, Icone: MessageCircleHeart, variant: 'info', cor: 'text-info' },
  regra: { rotulo: ROTULO_TIPO.regra, Icone: ScrollText, variant: 'brand', cor: 'text-brand' },
  situacao: { rotulo: ROTULO_TIPO.situacao, Icone: Signpost, variant: 'neutral', cor: 'text-muted' },
};

export function StatusBadge(
  props: (
    | { tipo: 'demanda'; status: StatusDemanda }
    | { tipo: 'conversa'; status: StatusConversa }
    | { tipo: 'orientacao'; status: TipoOrientacaoSelo }
  ) & { className?: string },
) {
  const a = props.tipo === 'demanda' ? STATUS_DEMANDA[props.status]
    : props.tipo === 'conversa' ? STATUS_CONVERSA[props.status]
    : TIPO_ORIENTACAO[props.status];
  if (!a) return null;
  const { Icone } = a;
  // Status de demanda: texto colorido com ponto, sem fundo (spec 4.2). A cor sempre vem com o texto.
  if (props.tipo === 'demanda') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold', a.cor, props.className)}>
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-current" />
        {a.rotulo}
      </span>
    );
  }
  return (
    <Badge variant={a.variant} className={props.className}>
      <Icone aria-hidden strokeWidth={1.75} />
      {a.rotulo}
    </Badge>
  );
}
