import type { Database } from '@escritorio/db';
import type { ReactNode } from 'react';
import type { ColunaTabela } from '@/components/patterns/data-table';
import { PrazoTexto, PrioridadeTexto } from '@/components/patterns/prioridade-prazo';
import { RelativeTime } from '@/components/patterns/relative-time';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { ROTULO_STATUS, type Prioridade } from '@/lib/demandas';
import { formatarDataHora } from '@/lib/formatos';

/** O que a tabela e o quadro leem da visão demandas_lista. */
/* Um literal só (sem concatenar): o supabase-js tira os tipos da própria string do select. */
export const COLUNAS_LISTA = 'id, numero, titulo, status, prioridade, prazo_em, prazo_pausado_desde, concluido_em, criado_em, atualizado_em, origem, criado_por_nome, responsavel_id, responsavel, contato, empresa, setor, conversa_id, fora_do_contrato, tem_pedido, pedido_venda, vencida';

export type LinhaLista = Pick<Database['public']['Views']['demandas_lista']['Row'],
  'id' | 'numero' | 'titulo' | 'status' | 'prioridade' | 'prazo_em' | 'prazo_pausado_desde' | 'concluido_em' | 'criado_em' | 'atualizado_em'
  | 'origem' | 'criado_por_nome' | 'responsavel_id' | 'responsavel' | 'contato' | 'empresa' | 'setor' | 'conversa_id' | 'fora_do_contrato'
  | 'tem_pedido' | 'pedido_venda' | 'vencida'>;

export type LinhaDemanda = {
  id: string; numero: number; titulo: string; status: StatusDemanda; prioridade: Prioridade;
  prazo: string | null; pausadoDesde: string | null; concluidaEm: string | null; criadoEm: string; atualizadoEm: string;
  origem: string; criadoPorNome: string | null; responsavelId: string | null; responsavel: string | null; contato: string | null;
  empresa: string | null; setor: string | null; conversaId: string | null; foraDoContrato: boolean; temPedido: boolean;
  /** Pendências do CSV do Bling (só com a permissão). */
  pendencias: string[];
  vencida: boolean;
};

/** A visão devolve tudo como "pode ser nulo"; a linha da tela tem os tipos de verdade. */
export function paraLinhaDemanda(d: LinhaLista, pendencias: string[]): LinhaDemanda {
  return {
    id: d.id!, numero: Number(d.numero), titulo: d.titulo ?? '', status: d.status as StatusDemanda, prioridade: (d.prioridade ?? 'normal') as Prioridade,
    prazo: d.prazo_em, pausadoDesde: d.prazo_pausado_desde, concluidaEm: d.concluido_em, criadoEm: d.criado_em!, atualizadoEm: d.atualizado_em!,
    origem: d.origem ?? 'agente', criadoPorNome: d.criado_por_nome, responsavelId: d.responsavel_id, responsavel: d.responsavel,
    contato: d.contato, empresa: d.empresa, setor: d.setor, conversaId: d.conversa_id, foraDoContrato: Boolean(d.fora_do_contrato),
    temPedido: Boolean(d.tem_pedido), pendencias, vencida: Boolean(d.vencida),
  };
}

/** "Por": quem abriu (pessoa) ou o robô. */
export function abertaPor(d: Pick<LinhaDemanda, 'criadoPorNome' | 'origem'>): string {
  return d.criadoPorNome ?? (d.origem === 'equipe' ? 'Equipe' : d.origem === 'sistema' ? 'Sistema' : 'Agente');
}

function Cabecalho({ l1, l2 }: { l1: string; l2: string }) {
  return <span className="flex flex-col leading-tight"><span>{l1}</span><span className="font-normal normal-case text-muted">{l2}</span></span>;
}

const segunda = 'block truncate text-sm text-muted';

/** Duas informações por coluna (spec 6.1, imagem 03). `acoes` é a segunda linha da coluna Setor (Assumir, Task 9). */
export function colunasDemandas(agora: Date, acoes?: (d: LinhaDemanda) => ReactNode): ColunaTabela<LinhaDemanda>[] {
  return [
    {
      id: 'assunto', titulo: <Cabecalho l1="Assunto [Nº]" l2="Empresa" />, className: 'w-full min-w-56 max-w-0',
      celula: (d) => (
        <div className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold text-foreground">{d.titulo}</span>
            <span className="tabular text-muted">[{d.numero}]</span>
            {d.temPedido && (d.pendencias.length > 0
              ? <Badge variant="warning" title={d.pendencias.join(' · ')}>Pedido de nota incompleto</Badge>
              : <Badge variant="brand">Pedido de nota</Badge>)}
            {d.foraDoContrato && <Badge variant="warning">Fora do contrato</Badge>}
          </span>
          {d.empresa ? <span className="truncate font-semibold text-brand">{d.empresa}</span> : <span className={segunda}>Empresa não identificada</span>}
        </div>
      ),
    },
    {
      id: 'situacao', titulo: <Cabecalho l1="Status · Prioridade · Prazo" l2="Abertura · Por" />,
      celula: (d) => (
        <div className="flex flex-col">
          <span>
            {ROTULO_STATUS[d.status]} · <PrioridadeTexto prioridade={d.prioridade} /> · <PrazoTexto prazo={d.prazo} pausadoDesde={d.pausadoDesde} concluidaEm={d.concluidaEm} agora={agora} />
          </span>
          <span className={segunda}><time dateTime={d.criadoEm} className="tabular">{formatarDataHora(d.criadoEm)}</time> · {abertaPor(d)}</span>
        </div>
      ),
    },
    {
      id: 'pessoas', titulo: <Cabecalho l1="Responsável interno" l2="Contato na empresa" />,
      celula: (d) => (
        <div className="flex flex-col">
          {d.responsavel ? <span>{d.responsavel}</span> : <span className="italic text-subtle">ninguém</span>}
          <span className={segunda}>{d.contato ?? '—'}</span>
        </div>
      ),
    },
    {
      id: 'atualizacao', titulo: <Cabecalho l1="Últ. atualização" l2="Origem" />,
      celula: (d) => (
        <div className="flex flex-col">
          <RelativeTime data={d.atualizadoEm} />
          <span className={segunda}>{d.origem === 'equipe' ? 'Equipe' : 'WhatsApp'}</span>
        </div>
      ),
    },
    {
      id: 'setor', titulo: <Cabecalho l1="Setor" l2="Ações" />,
      celula: (d) => (
        <div className="flex flex-col items-start">
          <span className="text-sm uppercase tracking-wide">{d.setor ?? 'Triagem'}</span>
          {acoes?.(d)}
        </div>
      ),
    },
  ];
}
