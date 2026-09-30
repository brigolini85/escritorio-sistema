import type { CompradorCadastrado } from '@escritorio/core';
import { TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatarBRL, formatarNumero } from '@/lib/formatos';
import { resumirPedido } from '@/lib/resumo-pedido';
import { MoneyText } from './money-text';

/**
 * Resumo do pedido de nota (chamados.pedido_venda): destinatário (CNPJ, endereço), itens (código, unidade, qtd,
 * preço, subtotal), total e o combinado (pagamento, entrega, frete). Item sem valor fica destacado "a conferir pelo Fiscal".
 * `comprador`: cadastro da unidade (parceiros_unidades), como no CSV do Bling; sem ele vale o texto do cliente.
 */
export function OrderSummary({
  pedido,
  comprador = null,
  className,
}: {
  pedido: unknown;
  comprador?: CompradorCadastrado | null;
  className?: string;
}) {
  const r = resumirPedido(pedido, comprador);
  if (!r) return <p className={cn('text-sm text-muted', className)}>Não foi possível ler este pedido.</p>;

  const combinado: [string, string | null][] = [
    ['Pagamento', r.pagamento],
    ['Entrega prevista', r.dataPrevista],
    ['Frete', [r.frete.valor ? formatarBRL(r.frete.valor) : null, r.frete.tipo].filter(Boolean).join(', ') || null],
    ['Transportadora', r.transportadora],
    ['Entregar em', r.entrega],
    ['Observações', r.observacoes],
  ];

  return (
    <section aria-label="Resumo do pedido de nota" className={cn('flex flex-col gap-3 text-base', className)}>
      <div className="rounded-md border border-border bg-surface p-3">
        <p className="text-xs font-medium text-muted">Destinatário</p>
        <p className="font-medium text-foreground">{r.destinatario.nome}</p>
        {r.destinatario.documento && <p className="tabular text-sm text-muted">CNPJ {r.destinatario.documento}</p>}
        {r.destinatario.endereco && <p className="text-sm text-muted">{r.destinatario.endereco}</p>}
        {!r.destinatario.cadastrado && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-warning">
            <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
            Destinatário não cadastrado: a equipe confere.
          </p>
        )}
        {r.data && <p className="mt-1 text-xs text-subtle">Pedido de {r.data}</p>}
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">Código</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="w-12">Un</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.itens.map((i, n) => (
              <TableRow key={n} className={cn(i.aConferir && 'bg-warning-soft hover:bg-warning-soft')}>
                <TableCell className={cn('tabular', i.aConferir ? 'text-warning' : 'text-muted')}>{i.codigo ?? '—'}</TableCell>
                <TableCell className={cn('font-medium', i.aConferir && 'text-warning')}>{i.produto}</TableCell>
                <TableCell className={cn(i.aConferir && 'text-warning')}>{i.unidade}</TableCell>
                <TableCell className={cn('tabular text-right', i.aConferir && 'text-warning')}>{i.quantidade === null ? '—' : formatarNumero(i.quantidade)}</TableCell>
                {i.aConferir ? (
                  <TableCell colSpan={2} className="text-right">
                    <Badge variant="warning" className="bg-surface">
                      <TriangleAlert aria-hidden strokeWidth={1.75} />
                      A conferir pelo Fiscal
                    </Badge>
                  </TableCell>
                ) : (
                  <>
                    <TableCell className="text-right"><MoneyText valor={i.valorUnitario} /></TableCell>
                    <TableCell className="text-right"><MoneyText valor={i.subtotal} /></TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="text-right">{r.totalParcial ? 'Total parcial' : 'Total'}</TableCell>
              <TableCell className="text-right font-semibold"><MoneyText valor={r.total} /></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        {r.totalParcial && (
          <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-sm text-warning">
            <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
            {r.itensAConferir === 1 ? '1 item sem valor' : `${r.itensAConferir} itens sem valor`}: o total não inclui {r.itensAConferir === 1 ? 'esse item' : 'esses itens'}. A conferir pelo Fiscal.
          </p>
        )}
      </div>

      {combinado.some(([, v]) => v) && (
        <dl className="flex flex-col gap-1 text-sm">
          {combinado.filter(([, v]) => v).map(([rotulo, valor]) => (
            <div key={rotulo} className="flex gap-4">
              <dt className="w-32 shrink-0 text-muted">{rotulo}</dt>
              <dd className="min-w-0 text-foreground">{valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
