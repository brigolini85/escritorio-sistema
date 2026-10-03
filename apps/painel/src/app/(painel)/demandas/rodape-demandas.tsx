import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { hrefComParams, type ParamsBusca } from '@/lib/tabela-url';
import { BotaoImprimir } from './botao-imprimir';

/** Rodapé da tabela (imagem 03): Imprimir e CSV Bling com todos os filtros da tela (500 pedidos por arquivo). */
export function RodapeDemandas({ params, partesBling, pedidosVenda }: { params: ParamsBusca; partesBling: number; pedidosVenda: number }) {
  // O arquivo segue os filtros; painel aberto, página, ordem e nova demanda não importam para ele.
  const href = (parte: number) =>
    `/api/csv-bling${hrefComParams(params, { demanda: null, pagina: null, nova: null, ordem: null, direcao: null, parte: partesBling > 1 ? parte : null })}`;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-4 print:hidden">
      <BotaoImprimir />
      {partesBling > 0 && (
        <span className="flex flex-wrap items-center gap-3">
          {Array.from({ length: partesBling }, (_, i) => (
            <BlingExportButton key={i} href={href(i + 1)} variante="link" rotulo={partesBling > 1 ? `CSV Bling (parte ${i + 1})` : 'CSV Bling'} />
          ))}
          <span className="text-sm text-muted">{pedidosVenda === 1 ? '1 pedido de nota neste filtro' : `${pedidosVenda} pedidos de nota neste filtro`}</span>
        </span>
      )}
    </div>
  );
}
