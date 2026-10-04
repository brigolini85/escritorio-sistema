import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import type { LimitesEspera, LinhaAtendimento, linhaDeEstado } from '@/lib/atendimento';
import { ItemConversa } from '../atendimento/item-conversa';

/**
 * Conversas esperando (imagens A e B): o mesmo item da lista do Atendimento (cronômetro, não lidas, linha de estado),
 * quem espera há mais tempo primeiro. Situação: todas com espera (D6); Mesa: "esperando você".
 */
export function ListaEsperando({ id, titulo, extra, dados, limites, estadoCtx, vazio, rodape }: {
  id: string; titulo: string; extra?: ReactNode; dados: { linhas: LinhaAtendimento[]; total: number } | null;
  limites: LimitesEspera; estadoCtx: Parameters<typeof linhaDeEstado>[1]; vazio: string; rodape?: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Card className="gap-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={id} className="text-sm font-bold uppercase tracking-wide text-brand">{titulo}</h2>
          {extra && <span className="text-sm text-subtle">{extra}</span>}
        </div>
        {dados === null ? (
          <p className="text-sm text-muted">As conversas não puderam ser lidas agora.</p>
        ) : dados.linhas.length === 0 ? (
          <p className="text-sm text-muted">{vazio}</p>
        ) : (
          <ul className="-mx-3 divide-y divide-border">
            {dados.linhas.map((l) => (
              <li key={l.id}><ItemConversa l={l} href={`/atendimento/${l.id}`} ativa={false} limites={limites} estadoCtx={estadoCtx} /></li>
            ))}
          </ul>
        )}
        {rodape}
      </Card>
    </section>
  );
}
