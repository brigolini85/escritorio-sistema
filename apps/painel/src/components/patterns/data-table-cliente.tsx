'use client';

import { RefreshCw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';

/**
 * Partes interativas do DataTable (seleção, clique na linha, "Tentar de novo").
 * A seleção vive no navegador; para uma ação em massa (server action), coloque <CamposSelecionados name="ids" />
 * dentro do <form>: ele gera um <input type="hidden"> por linha marcada.
 */

type Selecao = {
  selecionados: ReadonlySet<string>;
  todos: readonly string[];
  alternar: (id: string, marcado: boolean) => void;
  alternarTodos: (marcado: boolean) => void;
  limpar: () => void;
};

const ContextoSelecao = createContext<Selecao | null>(null);

/** Seleção atual (ids marcados). Fora de um DataTable selecionável, devolve seleção vazia. */
export function useSelecao(): Selecao {
  return useContext(ContextoSelecao) ?? { selecionados: new Set(), todos: [], alternar: () => {}, alternarTodos: () => {}, limpar: () => {} };
}

export function SelecaoTabela({ ids, aoMudarSelecao, children }: { ids: readonly string[]; aoMudarSelecao?: (ids: string[]) => void; children: ReactNode }) {
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(() => new Set());
  const chaveIds = ids.join('\n');

  // Linhas mudaram (filtro, página, tempo real): some da seleção o que não está mais na tela.
  useEffect(() => {
    const visiveis = new Set(chaveIds ? chaveIds.split('\n') : []);
    setSelecionados((atual) => {
      const filtrado = [...atual].filter((id) => visiveis.has(id));
      return filtrado.length === atual.size ? atual : new Set(filtrado);
    });
  }, [chaveIds]);

  useEffect(() => {
    aoMudarSelecao?.([...selecionados]);
    // Só a seleção dispara: aoMudarSelecao costuma ser uma função nova a cada render.
  }, [selecionados]);

  const alternar = useCallback((id: string, marcado: boolean) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }, []);
  const alternarTodos = useCallback((marcado: boolean) => setSelecionados(marcado ? new Set(ids) : new Set()), [ids]);
  const limpar = useCallback(() => setSelecionados(new Set()), []);
  const valor = useMemo(() => ({ selecionados, todos: ids, alternar, alternarTodos, limpar }), [selecionados, ids, alternar, alternarTodos, limpar]);
  return <ContextoSelecao.Provider value={valor}>{children}</ContextoSelecao.Provider>;
}

export function CaixaSelecaoLinha({ id, rotulo }: { id: string; rotulo: string }) {
  const { selecionados, alternar } = useSelecao();
  return <Checkbox aria-label={rotulo} checked={selecionados.has(id)} onCheckedChange={(v) => alternar(id, v === true)} />;
}

export function CaixaSelecaoTodas({ rotulo = 'Selecionar todas as linhas desta página' }: { rotulo?: string }) {
  const { selecionados, todos, alternarTodos } = useSelecao();
  const n = todos.filter((id) => selecionados.has(id)).length;
  const estado = n === 0 ? false : n === todos.length ? true : 'indeterminate';
  return <Checkbox aria-label={rotulo} disabled={todos.length === 0} checked={estado} onCheckedChange={() => alternarTodos(estado !== true)} />;
}

/** Um <input type="hidden" name={name}> por linha marcada, para o <form> da ação em massa. */
export function CamposSelecionados({ name }: { name: string }) {
  const { selecionados } = useSelecao();
  return <>{[...selecionados].map((id) => <input key={id} type="hidden" name={name} value={id} />)}</>;
}

/** Barra das ações em massa: aparece quando há linha marcada. */
export function BarraSelecao({ children }: { children: ReactNode }) {
  const { selecionados, limpar } = useSelecao();
  const n = selecionados.size;
  return (
    <div role="region" aria-label="Ações para as linhas selecionadas" aria-live="polite" className={cn(n === 0 && 'sr-only')}>
      {n > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-brand-soft px-3 py-2 text-sm text-brand">
          <span className="font-medium">{n === 1 ? '1 selecionada' : `${n} selecionadas`}</span>
          <div className="flex flex-wrap items-center gap-2">{children}</div>
          <Button type="button" variant="ghost" size="sm" onClick={limpar} className="ml-auto text-brand">
            <X aria-hidden size={16} strokeWidth={1.75} />
            Limpar seleção
          </Button>
        </div>
      )}
    </div>
  );
}

/** Clique em elementos interativos dentro da linha (links, botões, caixas) não abre a linha. */
const INTERATIVO = 'a, button, input, select, textarea, label, summary, [role="checkbox"], [role="button"], [role="menuitem"], [data-sem-clique-linha]';

/**
 * Linha da tabela: marca a seleção (data-state) e, com `href` ou `aoClicar`, abre ao clicar ou com Enter.
 * Ctrl/⌘ + clique abre o href em outra aba. Seleção de texto com o mouse não conta como clique.
 */
export function LinhaTabela({
  id,
  href,
  aoClicar,
  ativa = false,
  className,
  children,
}: {
  id: string;
  href?: string;
  aoClicar?: () => void;
  ativa?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { selecionados } = useSelecao();
  const clicavel = Boolean(href || aoClicar);

  const abrir = (novaAba: boolean) => {
    if (href && novaAba) window.open(href, '_blank', 'noopener');
    else if (href) router.push(href, { scroll: false });
    else aoClicar?.();
  };
  const aoClicarLinha = (e: MouseEvent<HTMLTableRowElement>) => {
    if (!clicavel || (e.target as HTMLElement).closest(INTERATIVO)) return;
    if (window.getSelection()?.toString()) return;
    abrir(e.ctrlKey || e.metaKey);
  };
  const aoTeclar = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (!clicavel || e.target !== e.currentTarget || e.key !== 'Enter') return;
    e.preventDefault();
    abrir(e.ctrlKey || e.metaKey);
  };

  return (
    <tr
      data-state={selecionados.has(id) ? 'selected' : undefined}
      aria-current={ativa || undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={clicavel ? aoClicarLinha : undefined}
      onKeyDown={clicavel ? aoTeclar : undefined}
      className={cn(
        'border-b border-border transition-colors duration-150 ease-out hover:bg-surface-muted data-[state=selected]:bg-brand-soft',
        clicavel && 'cursor-pointer',
        ativa && 'bg-surface-muted',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function BotaoTentarDeNovo() {
  const router = useRouter();
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
      <RefreshCw aria-hidden size={16} strokeWidth={1.75} />
      Tentar de novo
    </Button>
  );
}
