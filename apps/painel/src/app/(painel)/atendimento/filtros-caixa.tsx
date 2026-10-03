'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { consultaCaixa, FILTROS_MAIS, FILTROS_RAPIDOS, rotuloFiltroCaixa, type FiltroCaixa } from '@/lib/caixa';
import { cn } from '@/lib/cn';

const ESPERA_BUSCA_MS = 300;

/**
 * Filtros rápidos (Aguardando humano · Comigo · Com o agente · Concluídas), o menu "Mais" com os filtros
 * antigos (Todas, Do meu setor, Com o cliente) e a busca. Tudo na URL (?filtro=, ?q=), lido pela página no servidor.
 * `caminho`: a página atual (a lista ou a conversa aberta), para trocar o filtro sem fechar a conversa.
 */
export function FiltrosCaixa({ caminho, filtro, q }: { caminho: string; filtro: FiltroCaixa; q: string }) {
  const noMais = FILTROS_MAIS.some((f) => f.valor === filtro);
  return (
    <div className="flex flex-col gap-2">
      <BuscaCaixa caminho={caminho} filtro={filtro} q={q} />
      <nav aria-label="Filtros da caixa" className="flex flex-wrap items-center gap-1">
        {FILTROS_RAPIDOS.map((f) => (
          <Link
            key={f.valor}
            href={`${caminho}${consultaCaixa({ filtro: f.valor, q })}`}
            aria-current={f.valor === filtro ? 'true' : undefined}
            scroll={false}
            className={cn(
              'inline-flex h-7 items-center rounded-full border px-2.5 text-sm font-medium transition-colors duration-150 ease-out',
              f.valor === filtro
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground',
            )}
          >
            {f.rotulo}
          </Link>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-7 rounded-full px-2.5', noMais ? 'bg-brand-soft text-brand hover:bg-brand-soft' : 'text-muted')}
            >
              {noMais ? rotuloFiltroCaixa(filtro) : 'Mais'}
              <ChevronDown aria-hidden size={14} strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {FILTROS_MAIS.map((f) => (
              <DropdownMenuItem key={f.valor} asChild>
                <Link href={`${caminho}${consultaCaixa({ filtro: f.valor, q })}`} scroll={false} aria-current={f.valor === filtro ? 'true' : undefined}>
                  <Check aria-hidden size={16} strokeWidth={1.75} className={cn(f.valor === filtro ? 'opacity-100' : 'opacity-0')} />
                  {f.rotulo}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  );
}

function BuscaCaixa({ caminho, filtro, q }: { caminho: string; filtro: FiltroCaixa; q: string }) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const id = useId();
  const [texto, setTexto] = useState(q);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Eco da própria digitação não sobrescreve o campo (a pessoa pode já ter digitado mais).
  const ultimoEnviado = useRef(q);
  useEffect(() => {
    if (q === ultimoEnviado.current) return;
    ultimoEnviado.current = q;
    setTexto(q);
  }, [q]);
  useEffect(() => () => clearTimeout(espera.current), []);

  const enviar = (v: string) => {
    ultimoEnviado.current = v.trim();
    iniciar(() => router.replace(`${caminho}${consultaCaixa({ filtro, q: v.trim() })}`, { scroll: false }));
  };

  return (
    <div role="search" className="relative">
      <label htmlFor={id} className="sr-only">Buscar conversa</label>
      <Search aria-hidden size={16} strokeWidth={1.75} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
      <Input
        id={id}
        type="search"
        value={texto}
        placeholder="Nome, empresa ou telefone"
        className="h-8 pl-8"
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setTexto(v);
          clearTimeout(espera.current);
          espera.current = setTimeout(() => enviar(v), ESPERA_BUSCA_MS);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            clearTimeout(espera.current);
            enviar(texto);
          }
        }}
      />
    </div>
  );
}
