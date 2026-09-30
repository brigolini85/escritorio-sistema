'use client';

import { FileSpreadsheet } from 'lucide-react';
import { useSelecao } from '@/components/patterns/data-table-cliente';
import { Button } from '@/components/ui/button';

/**
 * "Exportar selecionadas": manda para a rota existente /api/csv-bling?ids=a,b só as demandas marcadas que têm
 * pedido de nota (as outras não entram no arquivo e isso é dito ao lado do botão).
 */
export function ExportarSelecionadas({ comPedido }: { comPedido: string[] }) {
  const { selecionados } = useSelecao();
  const validos = comPedido.filter((id) => selecionados.has(id));
  const fora = selecionados.size - validos.length;
  return (
    <form method="get" action="/api/csv-bling" className="flex flex-wrap items-center gap-2">
      {validos.length > 0 && <input type="hidden" name="ids" value={validos.join(',')} />}
      <Button type="submit" variant="outline" size="sm" disabled={validos.length === 0}>
        <FileSpreadsheet aria-hidden size={16} strokeWidth={1.75} />
        Exportar selecionadas
      </Button>
      {fora > 0 && (
        <span className="text-sm text-muted">
          {validos.length === 0
            ? 'Nenhuma das selecionadas tem pedido de nota.'
            : fora === 1 ? '1 sem pedido de nota fica fora do arquivo.' : `${fora} sem pedido de nota ficam fora do arquivo.`}
        </span>
      )}
    </form>
  );
}
