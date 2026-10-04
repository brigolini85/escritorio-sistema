import { CircleAlert } from 'lucide-react';
import Link from 'next/link';
import { PrazoTexto } from '@/components/patterns/prioridade-prazo';
import { Card } from '@/components/ui/card';
import { totaisDosSetores } from '@/lib/inicio';
import { paginaInicio } from './dados-inicio';
import { lerSetoresSituacao, lerVencidasSituacao } from './dados-situacao';

/** As cinco vencidas mais antigas (imagem A); o total é o do cartão (soma por setor). */
export async function ListaVencidas() {
  const [vencidas, setores, { agora }] = await Promise.all([lerVencidasSituacao(), lerSetoresSituacao(), paginaInicio()]);
  const total = setores ? totaisDosSetores(setores).vencidas : vencidas?.length ?? null;
  return (
    <section aria-labelledby="titulo-vencidas">
      <Card className="gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="titulo-vencidas" className="flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-danger">
            <CircleAlert aria-hidden size={14} strokeWidth={2} />Vencidas
          </h2>
          <span className="tabular text-sm text-subtle">{total ?? '—'}</span>
        </div>
        {vencidas === null ? (
          <p className="text-sm text-muted">As vencidas não puderam ser lidas agora.</p>
        ) : vencidas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma demanda vencida.</p>
        ) : (
          <ul className="divide-y divide-border">
            {vencidas.map((d) => (
              <li key={d.id}>
                <Link href={`/demandas?demanda=${d.id}`} className="flex items-center gap-3 py-2 hover:bg-surface-muted">
                  <span className="tabular w-14 shrink-0 font-bold text-foreground">#{d.numero}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">{d.titulo}</span>
                    <span className="block truncate text-sm text-muted">
                      {[d.empresa ?? 'sem empresa', d.setor ?? 'Triagem'].join(' · ')} · {d.responsavel ?? <em>sem responsável</em>}
                    </span>
                  </span>
                  <PrazoTexto prazo={d.prazo_em} pausadoDesde={d.prazo_pausado_desde} concluidaEm={null} agora={agora} className="shrink-0 text-sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
