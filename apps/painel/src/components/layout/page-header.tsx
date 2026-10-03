import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Migalha = { rotulo: string; href?: string };

/** Cabeçalho de página: trilha opcional, título, descrição curta e ações à direita. */
export function PageHeader({
  titulo,
  contagem,
  secao,
  descricao,
  acoes,
  migalhas,
  className,
}: {
  titulo: ReactNode;
  contagem?: number;
  secao?: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  migalhas?: Migalha[];
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-col gap-1', className)}>
      {migalhas && migalhas.length > 0 && (
        <nav aria-label="Trilha">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            {migalhas.map((m, i) => (
              <li key={`${m.rotulo}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden size={14} strokeWidth={1.75} className="text-subtle" />}
                {m.href ? <Link href={m.href} className="hover:text-foreground hover:underline">{m.rotulo}</Link> : <span aria-current="page">{m.rotulo}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {secao && <p className="text-xs font-bold uppercase tracking-widest text-brand">{secao}</p>}
          <h1 className="text-3xl font-light text-foreground">
            {titulo}
            {contagem !== undefined && <> <strong className="tabular font-extrabold text-brand">{contagem}</strong></>}
          </h1>
          {descricao && <p className="mt-1 text-base text-muted">{descricao}</p>}
        </div>
        {acoes && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </header>
  );
}
