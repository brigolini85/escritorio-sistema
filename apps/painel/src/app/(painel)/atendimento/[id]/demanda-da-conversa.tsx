import type { CompradorCadastrado } from '@escritorio/core';
import { CircleCheck, Clock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { LinhaDoTempoDemanda } from '@/components/patterns/linha-do-tempo-demanda';
import { MoneyText } from '@/components/patterns/money-text';
import { OrderSummary } from '@/components/patterns/order-summary';
import { RelativeTime } from '@/components/patterns/relative-time';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { pendenciasCsvBling, resumirPedido } from '@/lib/resumo-pedido';
import type { DemandaDaConversa as AcoesDaDemanda } from './acoes-conversa';
import type { DemandaDetalhe } from './tipos-conversa';
import { VerPedido } from './ver-pedido';

/** Demanda desta conversa na aba CLIENTE: o que estava em Detalhes (resumo, pedido + CSV, linha do tempo) e as ações dela. */
export function DemandaDaConversa({ d, acoes, comprador, podeCsv }: {
  d: DemandaDetalhe; acoes: AcoesDaDemanda; comprador: CompradorCadastrado | null; podeCsv: boolean;
}) {
  const problemas = pendenciasCsvBling(d.numero, d.pedido_venda, comprador);
  return (
    <article className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-foreground"><span className="tabular text-muted">#{d.numero}</span> · {d.titulo}</h4>
        <StatusBadge tipo="demanda" status={d.status} className="mt-0.5" />
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
        <span>{d.setor ?? 'Triagem'}</span>
        <span aria-hidden>·</span>
        <span>{d.responsavel ?? 'Sem responsável'}</span>
        <span aria-hidden>·</span>
        <span>aberta <RelativeTime data={d.criado_em} /></span>
        {d.fora_do_contrato && <Badge variant="warning">Fora do contrato</Badge>}
      </p>
      {d.resumo && <p className="whitespace-pre-wrap text-foreground">{d.resumo}</p>}
      {d.pedido_venda ? (
        <ResumoPedidoCurto numero={d.numero} pedido={d.pedido_venda} comprador={comprador}>
          {podeCsv && <BlingExportButton href={`/api/csv-bling?id=${d.id}`} problemas={problemas} />}
        </ResumoPedidoCurto>
      ) : null}
      <LinhaDoTempoDemanda numero={d.numero} eventos={d.eventos} />
      <div className="flex flex-wrap items-center gap-2">
        {d.status !== 'aguardando_cliente' && (
          <form action={acoes.aguardandoCliente}>
            <Button size="sm" variant="outline" aria-label={`Marcar a demanda #${d.numero} como com o cliente`}><Clock aria-hidden size={16} strokeWidth={1.75} />Com o cliente</Button>
          </form>
        )}
        <ConfirmDialog
          gatilho={<Button size="sm" variant="outline" aria-label={`Concluir a demanda #${d.numero}`}><CircleCheck aria-hidden size={16} strokeWidth={1.75} />Concluir demanda</Button>}
          titulo={`Concluir a demanda #${d.numero}?`}
          descricao={`“${d.titulo}” sai das demandas abertas desta conversa.`}
          confirmar="Concluir"
          enviando="Concluindo…"
          variante="primary"
          tipo="concluir"
          acao={acoes.concluir}
        />
        <Link href={`/demandas?demanda=${d.id}`} aria-label={`Abrir a demanda #${d.numero} no painel`} className="text-sm text-brand underline-offset-4 hover:underline">abrir no painel</Link>
      </div>
    </article>
  );
}

/** Pedido de nota em poucas linhas (cabe nos 360px); o completo, com a tabela de itens, abre em "Ver pedido". */
function ResumoPedidoCurto({ numero, pedido, comprador, children }: { numero: number; pedido: unknown; comprador: CompradorCadastrado | null; children?: ReactNode }) {
  const r = resumirPedido(pedido, comprador);
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-muted p-2.5">
      {r ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-muted">Pedido de nota</p>
          <p className="font-medium text-foreground">{r.destinatario.nome}</p>
          <p className="text-xs text-muted">
            {r.itens.length === 1 ? '1 item' : `${r.itens.length} itens`} · {r.totalParcial ? 'Total parcial' : 'Total'}{' '}
            <MoneyText valor={r.total} className="font-medium text-foreground" />
          </p>
          {r.itensAConferir > 0 && (
            <p className="text-xs text-warning">
              {r.itensAConferir === 1 ? '1 item sem valor' : `${r.itensAConferir} itens sem valor`}: a conferir pelo Fiscal
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted">Não foi possível ler este pedido.</p>
      )}
      <div className="flex flex-wrap items-start gap-2">
        <VerPedido numero={numero}>
          <OrderSummary pedido={pedido} comprador={comprador} />
        </VerPedido>
        {children}
      </div>
    </div>
  );
}
