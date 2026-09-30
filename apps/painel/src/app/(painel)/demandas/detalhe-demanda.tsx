import type { CompradorCadastrado } from '@escritorio/core';
import { MessageSquare, SearchX } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { DocumentText } from '@/components/patterns/document-text';
import { EmptyState } from '@/components/patterns/empty-state';
import { LinhaDoTempoDemanda, type EventoDemanda } from '@/components/patterns/linha-do-tempo-demanda';
import { OrderSummary } from '@/components/patterns/order-summary';
import { RelativeTime } from '@/components/patterns/relative-time';
import { StatusBadge, type StatusDemanda } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatarDataHora } from '@/lib/formatos';
import { pendenciasCsvBling } from '@/lib/resumo-pedido';

export type DemandaAberta = {
  id: string;
  numero: number;
  titulo: string;
  resumo: string;
  status: StatusDemanda;
  criado_em: string;
  conversa_id: string | null;
  fora_do_contrato: boolean;
  pedido_venda: unknown;
  setor: string | null;
  responsavel: string | null;
  empresa: { id: string; nome: string; cnpj: string } | null;
  eventos: EventoDemanda[];
};

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">{titulo}</h3>
      {children}
    </section>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** Conteúdo do painel lateral de Demandas: detalhes, resumo, pedido de nota com o CSV do Bling e a linha do tempo. */
export function DetalheDemanda({ demanda: d, comprador, podeCsv }: { demanda: DemandaAberta | null; comprador: CompradorCadastrado | null; podeCsv: boolean }) {
  if (!d) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Demanda não encontrada</SheetTitle>
          <SheetDescription className="sr-only">A demanda do endereço não existe ou é de outro setor.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <EmptyState icone={SearchX} titulo="Não encontrei esta demanda." descricao="Ela pode ter sido apagada ou ser de um setor que você não atende." />
        </SheetBody>
      </>
    );
  }
  const problemas = pendenciasCsvBling(d.numero, d.pedido_venda, comprador);
  return (
    <>
      <SheetHeader>
        <SheetTitle><span className="tabular text-muted">#{d.numero}</span> · {d.titulo}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge tipo="demanda" status={d.status} />
          {d.pedido_venda ? <Badge variant="brand">Pedido de nota</Badge> : null}
          {d.fora_do_contrato && <Badge variant="warning">Fora do contrato</Badge>}
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <Secao titulo="Detalhes">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo rotulo="Empresa">
              {d.empresa ? (
                <Link href={`/clientes/${d.empresa.id}`} className="text-brand underline-offset-4 hover:underline">{d.empresa.nome}</Link>
              ) : <span className="text-muted">Não identificada</span>}
              {d.empresa?.cnpj && <DocumentText tipo="cnpj" valor={d.empresa.cnpj} className="block text-xs text-muted" />}
            </Campo>
            <Campo rotulo="Setor">{d.setor ?? 'Triagem'}</Campo>
            <Campo rotulo="Responsável">{d.responsavel ?? <Badge variant="warning">Sem responsável</Badge>}</Campo>
            <Campo rotulo="Aberta">
              <time dateTime={d.criado_em} className="tabular">{formatarDataHora(d.criado_em)}</time>
              <span className="text-muted"> (<RelativeTime data={d.criado_em} />)</span>
            </Campo>
          </dl>
        </Secao>
        {d.resumo && (
          <Secao titulo="Resumo">
            <p className="whitespace-pre-wrap text-sm text-foreground">{d.resumo}</p>
          </Secao>
        )}
        {d.pedido_venda ? (
          <Secao titulo="Pedido de nota">
            <OrderSummary pedido={d.pedido_venda} comprador={comprador} />
            {podeCsv && <BlingExportButton href={`/api/csv-bling?id=${d.id}`} problemas={problemas} />}
          </Secao>
        ) : null}
        <Secao titulo="Linha do tempo">
          {d.eventos.length > 0
            ? <LinhaDoTempoDemanda numero={d.numero} eventos={d.eventos} />
            : <p className="text-sm text-muted">Nenhum evento registrado.</p>}
        </Secao>
      </SheetBody>
      {d.conversa_id && (
        <SheetFooter>
          <Link href={`/atendimento/${d.conversa_id}`} className={variantesBotao({ variant: 'primary', size: 'sm' })}>
            <MessageSquare aria-hidden size={16} strokeWidth={1.75} />
            Abrir conversa
          </Link>
        </SheetFooter>
      )}
    </>
  );
}
