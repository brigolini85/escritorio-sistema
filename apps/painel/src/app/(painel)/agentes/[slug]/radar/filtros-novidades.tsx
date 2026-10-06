'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { ESTADOS_NOVIDADE, IMPACTOS, ROTULO_ESTADO_NOVIDADE, ROTULO_IMPACTO, type EstadoNovidade } from '@escritorio/core';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import type { FiltroRadar } from '@/lib/radar';
import { hrefComParams } from '@/lib/tabela-url';

const BASE = '/agentes/radar';
const TODOS = 'todos';
const aba = (ativa: boolean) => cn('inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-bold',
  ativa ? 'border-grafite bg-grafite text-grafite-foreground' : 'border-border bg-surface text-foreground hover:bg-surface-muted');

/** Abas, setor, impacto e busca das novidades. Tudo pela URL (como os filtros de Agentes): a tela recarrega no servidor. */
export function FiltrosNovidades({ filtro, contagem, setores }: {
  filtro: FiltroRadar; contagem: Record<EstadoNovidade, number>; setores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(filtro.q);
  // O estado "Para decidir" é o padrão: não precisa aparecer na URL.
  const params = { estado: filtro.estado === 'para_decidir' ? undefined : filtro.estado, setor: filtro.setor ?? undefined, impacto: filtro.impacto ?? undefined, q: filtro.q || undefined };
  const ir = (mudancas: Record<string, string | null>) => router.replace(`${BASE}${hrefComParams(params, mudancas)}`, { scroll: false });
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Novidades" className="flex flex-wrap gap-2">
        {ESTADOS_NOVIDADE.map((e) => (
          <Link key={e} href={`${BASE}${hrefComParams(params, { estado: e === 'para_decidir' ? null : e })}`} scroll={false} aria-current={filtro.estado === e ? 'page' : undefined} className={aba(filtro.estado === e)}>
            {ROTULO_ESTADO_NOVIDADE[e]} <span className="tabular">{contagem[e]}</span>
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtro.setor ?? TODOS} onValueChange={(v) => ir({ setor: v === TODOS ? null : v })}>
          <SelectTrigger size="sm" aria-label="Setor" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Setor: todos</SelectItem>
            {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtro.impacto ?? TODOS} onValueChange={(v) => ir({ impacto: v === TODOS ? null : v })}>
          <SelectTrigger size="sm" aria-label="Impacto" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Impacto: todos</SelectItem>
            {IMPACTOS.map((i) => <SelectItem key={i} value={i}>Impacto {ROTULO_IMPACTO[i].toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
        <form role="search" className="relative" onSubmit={(e) => { e.preventDefault(); ir({ q: q.trim() || null }); }}>
          <Search aria-hidden size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar novidade" placeholder="Buscar" className="h-8 w-56 pl-8" />
        </form>
        <p className="text-xs text-muted">ordenadas por impacto · mais recentes primeiro</p>
      </div>
    </div>
  );
}
