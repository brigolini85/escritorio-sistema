'use client';

import { ChevronRight, House, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AgentStateIndicator, type EstadoAgente } from '@/components/patterns/agent-state-indicator';
import { cn } from '@/lib/cn';
import { BuscaGlobal } from './busca-global';
import { MenuUsuario } from './menu-usuario';
import { trilhaDaRota } from './trilha';

/** Trilha da tela atual (casa › Seção › Tela); o último passo é a página e não é link. */
function TrilhaPassos({ passos }: { passos: ReturnType<typeof trilhaDaRota> }) {
  return (
    // Abaixo de sm a trilha some: o título da página já diz onde se está e a busca precisa do espaço.
    <nav aria-label="Trilha" className="hidden min-w-0 flex-1 sm:block">
      <ol className="flex min-w-0 items-center gap-1.5 text-base">
        <li className="shrink-0">
          <Link
            href="/inicio"
            aria-label="Início"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground"
          >
            <House aria-hidden size={16} strokeWidth={1.75} />
          </Link>
        </li>
        {passos.map((p, i) => {
          const ultimo = i === passos.length - 1;
          return (
            // O último passo pode encolher (nome longo); os do meio ficam inteiros.
            <li key={`${i}-${p.rotulo}`} className={cn('flex items-center gap-1.5', ultimo ? 'min-w-0' : 'shrink-0')}>
              <ChevronRight aria-hidden size={14} strokeWidth={1.75} className="shrink-0 text-subtle" />
              {ultimo ? (
                <span aria-current="page" className="truncate font-bold text-foreground">{p.rotulo}</span>
              ) : p.href ? (
                <Link href={p.href} className="truncate text-muted underline-offset-4 hover:text-foreground hover:underline">{p.rotulo}</Link>
              ) : (
                <span className="truncate text-muted">{p.rotulo}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A seção de Configurações vem da busca (?secao=); useSearchParams pede Suspense. */
function TrilhaComSecao() {
  return <TrilhaPassos passos={trilhaDaRota(usePathname(), useSearchParams().get('secao'))} />;
}
function Trilha() {
  const pathname = usePathname();
  return (
    <Suspense fallback={<TrilhaPassos passos={trilhaDaRota(pathname)} />}>
      <TrilhaComSecao />
    </Suspense>
  );
}

/** Barra do topo: menu (só em telas menores), trilha, busca global, estado geral do agente e menu da pessoa. */
export function Topbar({
  estadoAgente,
  onAbrirMenu,
}: {
  estadoAgente: EstadoAgente | null;
  onAbrirMenu: () => void;
}) {
  return (
    <div className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6">
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir menu"
        className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground lg:hidden"
      >
        <Menu aria-hidden size={20} strokeWidth={1.75} />
      </button>
      <Trilha />
      <div className="min-w-0 flex-1 sm:w-44 sm:flex-none md:w-72">
        <BuscaGlobal />
      </div>
      {estadoAgente && <AgentStateIndicator estado={estadoAgente} />}
      <MenuUsuario />
    </div>
  );
}
