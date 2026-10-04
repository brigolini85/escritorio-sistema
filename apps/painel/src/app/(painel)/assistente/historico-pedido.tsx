import { cn } from '@/lib/cn';
import { quandoNoHistorico, type Marco } from '@/lib/pedido-assistente';

const COR: Record<Marco['tipo'], string> = {
  abertura: 'bg-agent-active', previa: 'bg-warning-decor', gravado: 'bg-brand', arquivo: 'bg-success', evento: 'bg-subtle',
};
const MAX = 12;

/** Histórico do pedido (D4): só o que está gravado e a pessoa pode ler. Cor é só enfeite; o texto diz o que houve. */
export function HistoricoPedido({ marcos, agora }: { marcos: Marco[]; agora: Date }) {
  const mostrados = marcos.slice(-MAX);
  return (
    <section aria-labelledby="titulo-historico-pedido" className="rounded-lg border border-border bg-surface px-5 py-4">
      <h4 className="mb-2.5 flex justify-between text-xs font-extrabold uppercase tracking-widest text-brand">
        <span id="titulo-historico-pedido">Histórico do pedido</span>
        <span className="font-semibold normal-case tracking-normal text-subtle">{marcos.length === 1 ? '1 evento' : `${marcos.length} eventos`}</span>
      </h4>
      {mostrados.length === 0 ? <p className="text-sm text-muted">Nenhum evento para mostrar.</p> : (
        <ol className="flex flex-col gap-1.5 text-sm">
          {mostrados.map((m, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <time dateTime={m.em} className="w-12 shrink-0 tabular text-subtle">{quandoNoHistorico(m.em, agora)}</time>
              <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', COR[m.tipo])} />
              <span className={cn('min-w-0', m.tipo === 'gravado' && 'font-bold')}>{m.texto}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
