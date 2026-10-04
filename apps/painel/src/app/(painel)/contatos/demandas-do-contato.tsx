import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { ROTULO_PRIORIDADE } from '@/lib/demandas';
import { descreverPrazo } from '@/lib/prazo';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerDemandasDoContato } from './dados-contatos';
import { SecaoPainel } from './secao-painel';

/** Demandas abertas do contato (D16), pela regra de leitura de quem abre o painel. Urgente e vencida em vermelho com texto. */
export async function DemandasDoContato({ contatoId, agora }: { contatoId: string; agora: Date }) {
  const sb = await supabaseServidor();
  const r = await lerDemandasDoContato(sb, contatoId);
  return (
    <SecaoPainel titulo="Demandas abertas" extra={r ? String(r.total) : null}>
      {!r ? (
        <p className="text-sm text-muted">Não consegui ler as demandas agora.</p>
      ) : r.linhas.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma demanda aberta que você veja.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {r.linhas.map((d) => {
            const p = descreverPrazo({ prazo: d.prazo, pausadoDesde: d.pausadoDesde, concluidaEm: null }, agora);
            const alerta = d.prioridade === 'urgente' || p.tom === 'vencido';
            return (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/demandas?demanda=${d.id}`} className="min-w-0 truncate text-foreground hover:underline">
                  <strong className="tabular">#{d.numero}</strong> {d.titulo}
                </Link>
                <span className={cn('shrink-0 text-xs font-bold uppercase tracking-wide', alerta ? 'text-danger' : 'text-muted')}>
                  {ROTULO_PRIORIDADE[d.prioridade]} · {p.texto}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {r && r.total > r.linhas.length && <p className="text-sm text-muted">e mais {r.total - r.linhas.length}.</p>}
    </SecaoPainel>
  );
}

export function EsqueletoDemandasDoContato() {
  return (
    <div role="status" aria-label="Carregando as demandas do contato" className="flex flex-col gap-2 py-4">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
