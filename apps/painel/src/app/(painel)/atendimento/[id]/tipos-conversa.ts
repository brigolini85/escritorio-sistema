import type { EventoDemanda } from '@/components/patterns/linha-do-tempo-demanda';
import type { StatusDemanda } from '@/components/patterns/status-badge';

export type DemandaDetalhe = {
  id: string; numero: number; titulo: string; resumo: string; status: StatusDemanda; setor: string | null; responsavel: string | null;
  fora_do_contrato: boolean; criado_em: string; pedido_venda: unknown; eventos: EventoDemanda[];
};
