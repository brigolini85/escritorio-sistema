'use client';

import { FileSpreadsheet } from 'lucide-react';
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { useSelecao } from '@/components/patterns/data-table-cliente';
import { Button } from '@/components/ui/button';

/**
 * "Exportar selecionadas": link para a rota existente /api/csv-bling?ids=a,b só com as demandas marcadas que têm
 * pedido de nota (as outras não entram no arquivo e isso é dito ao lado). As pendências dessas demandas
 * (problemasPedidoBling, calculadas na página com o comprador cadastrado) aparecem antes: com pendência, o botão
 * fica desabilitado e a lista diz o que completar, em vez de levar à página de aviso da rota.
 */
export function ExportarSelecionadas({ pedidos }: { pedidos: Record<string, string[]> }) {
  const { selecionados } = useSelecao();
  const validos = [...selecionados].filter((id) => id in pedidos);
  const fora = selecionados.size - validos.length;
  const pendencias = validos.flatMap((id) => pedidos[id] ?? []);
  return (
    <div className="flex flex-wrap items-start gap-2">
      {validos.length > 0 ? (
        <BlingExportButton href={`/api/csv-bling?ids=${validos.join(',')}`} rotulo="Exportar selecionadas" problemas={pendencias} className="items-start" />
      ) : (
        <Button type="button" variant="outline" size="sm" disabled>
          <FileSpreadsheet aria-hidden size={16} strokeWidth={1.75} />
          Exportar selecionadas
        </Button>
      )}
      {fora > 0 && (
        <span className="self-center text-sm text-muted">
          {validos.length === 0
            ? 'Nenhuma das selecionadas tem pedido de nota.'
            : fora === 1 ? '1 sem pedido de nota fica fora do arquivo.' : `${fora} sem pedido de nota ficam fora do arquivo.`}
        </span>
      )}
    </div>
  );
}
