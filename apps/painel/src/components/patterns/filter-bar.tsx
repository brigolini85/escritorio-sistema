'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { hrefComParams, type ParamsBusca } from '@/lib/tabela-url';

export type FiltroBarra = {
  /** Nome do parâmetro na URL (o mesmo que a página já lê, ex.: "setor"). */
  param: string;
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  /** Opção "sem filtro" (tira o parâmetro da URL), ex.: "Todos os setores". */
  todos?: string;
};

const TODOS = '__todos';
const ESPERA_BUSCA_MS = 300;

function paraParams(sp: URLSearchParams): ParamsBusca {
  const p: Record<string, string | string[]> = {};
  for (const k of new Set(sp.keys())) {
    const v = sp.getAll(k);
    p[k] = v.length > 1 ? v : v[0]!;
  }
  return p;
}

/**
 * Busca + filtros (setor, status, responsável...) + contagem de resultados. O estado fica na URL:
 * a página (server component) lê os mesmos searchParams e filtra. Mudar algo volta para a página 1.
 */
export function FilterBar({
  busca,
  filtros = [],
  total,
  children,
  className,
}: {
  busca?: { param?: string; placeholder: string; rotulo?: string };
  filtros?: FiltroBarra[];
  /** Quantidade de resultados com os filtros atuais. */
  total?: number;
  /** Controles extras (ex.: período). */
  children?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  const idBusca = useId();
  const paramBusca = busca?.param ?? 'q';
  const buscaUrl = sp.get(paramBusca) ?? '';
  const [texto, setTexto] = useState(buscaUrl);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Última busca que este campo mandou para a URL. Quando a URL chega com ela, é eco da própria digitação
  // (a pessoa pode já ter digitado mais letras): o campo não é sobrescrito.
  const ultimoEnviado = useRef(buscaUrl);

  // Voltar/avançar do navegador, "Limpar filtros" ou link externo: o campo acompanha a URL.
  useEffect(() => {
    if (buscaUrl === ultimoEnviado.current) return;
    ultimoEnviado.current = buscaUrl;
    setTexto(buscaUrl);
  }, [buscaUrl]);
  useEffect(() => () => clearTimeout(espera.current), []);

  const ir = (mudancas: Record<string, string | null>) => {
    iniciar(() => router.replace(`${pathname}${hrefComParams(paraParams(new URLSearchParams(sp.toString())), mudancas)}`, { scroll: false }));
  };
  const enviarBusca = (v: string) => {
    ultimoEnviado.current = v.trim();
    ir({ [paramBusca]: v.trim() || null });
  };
  const aoDigitar = (v: string) => {
    setTexto(v);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => enviarBusca(v), ESPERA_BUSCA_MS);
  };

  const ativos = [...(busca && buscaUrl ? [paramBusca] : []), ...filtros.filter((f) => sp.get(f.param)).map((f) => f.param)];

  return (
    <div role="search" aria-label="Filtros" className={cn('flex flex-wrap items-center gap-2', className)}>
      {busca && (
        <div className="relative w-full sm:w-64">
          <label htmlFor={idBusca} className="sr-only">{busca.rotulo ?? busca.placeholder}</label>
          <Search aria-hidden size={16} strokeWidth={1.75} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
          <Input
            id={idBusca}
            type="search"
            value={texto}
            onChange={(e) => aoDigitar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                clearTimeout(espera.current);
                enviarBusca(texto);
              }
            }}
            placeholder={busca.placeholder}
            className="h-8 pl-8"
          />
        </div>
      )}
      {filtros.map((f) => {
        const atual = sp.get(f.param) ?? TODOS;
        const id = `${idBusca}-${f.param}`;
        return (
          <div key={f.param} className="flex items-center">
            <label htmlFor={id} className="sr-only">{f.rotulo}</label>
            <Select value={atual} onValueChange={(v) => ir({ [f.param]: v === TODOS ? null : v })}>
              <SelectTrigger id={id} className={cn('h-8 w-auto min-w-36 text-sm', atual !== TODOS && 'border-brand text-brand')}>
                <span className="text-muted">{f.rotulo}:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>{f.todos ?? 'Todos'}</SelectItem>
                {f.opcoes.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      })}
      {children}
      {ativos.length > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => { clearTimeout(espera.current); ir(Object.fromEntries(ativos.map((p) => [p, null]))); }}>
          <X aria-hidden size={16} strokeWidth={1.75} />
          Limpar filtros
        </Button>
      )}
      {total !== undefined && (
        <p aria-live="polite" className={cn('ml-auto text-sm text-muted tabular', pendente && 'opacity-60')}>
          {total === 0 ? 'Nenhum resultado' : total === 1 ? '1 resultado' : `${total.toLocaleString('pt-BR')} resultados`}
        </p>
      )}
    </div>
  );
}
