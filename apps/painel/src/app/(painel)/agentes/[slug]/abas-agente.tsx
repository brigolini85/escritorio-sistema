'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { ABAS_AGENTE, abaAtual, hrefAba } from './ficha';

/** Abas como links (cada uma uma rota, D20); a atual com aria-current. */
export function AbasAgente({ slug, contagem }: { slug: string; contagem: Record<string, number> }) {
  const atual = abaAtual(usePathname(), slug);
  return (
    <nav aria-label="Seções do agente" className="-mx-1 overflow-x-auto border-b border-border px-1">
      <ul className="flex gap-1">
        {ABAS_AGENTE.map((a) => {
          const ativa = a.segmento === atual;
          return (
            <li key={a.segmento}>
              <Link href={hrefAba(slug, a.segmento)} aria-current={ativa ? 'page' : undefined} scroll={false}
                className={cn('-mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors duration-150 ease-out',
                  ativa ? 'border-brand text-foreground' : 'border-transparent text-muted hover:border-border hover:text-foreground')}>
                {a.rotulo}
                {contagem[a.segmento] !== undefined && <span className="tabular rounded-sm bg-surface-muted px-1 text-xs text-muted">{contagem[a.segmento]}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
