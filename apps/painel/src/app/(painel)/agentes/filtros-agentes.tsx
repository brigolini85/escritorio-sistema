import Link from 'next/link';
import { Search } from 'lucide-react';
import { ROTULO_TIPO_AGENTE, TIPOS_AGENTE, type EstadoAgente } from '@escritorio/core';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { hrefComParams, type ParamsBusca } from '@/lib/tabela-url';
import type { FiltrosAgentes } from './lista';

const chip = (ativo: boolean) => cn('inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-bold',
  ativo ? 'border-grafite bg-grafite text-grafite-foreground' : 'border-border bg-surface text-foreground hover:bg-surface-muted');

/** Filtros por estado (com contagem) e tipo, e a busca (spec 7E.2). Links simples: a tela recarrega no servidor. */
export function FiltrosAgentes({ params, f, contagem }: { params: ParamsBusca; f: FiltrosAgentes; contagem: Record<'todos' | EstadoAgente, number> }) {
  const estados: { valor: EstadoAgente | null; rotulo: string; n: number }[] = [
    { valor: null, rotulo: 'Todos', n: contagem.todos }, { valor: 'ligado', rotulo: 'Ligados', n: contagem.ligado },
    { valor: 'teste', rotulo: 'Em teste', n: contagem.teste }, { valor: 'desligado', rotulo: 'Desligados', n: contagem.desligado },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Estado" className="flex flex-wrap gap-2">
        {estados.map((e) => (
          <Link key={e.rotulo} href={`/agentes${hrefComParams(params, { estado: e.valor })}`} aria-current={f.estado === e.valor ? 'page' : undefined} className={chip(f.estado === e.valor)}>
            {e.valor && <span aria-hidden>●</span>}{e.rotulo} <span className="tabular">{e.n}</span>
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Tipo" className="flex gap-1">
          {[null, ...TIPOS_AGENTE].map((t) => (
            <Link key={t ?? 'todos'} href={`/agentes${hrefComParams(params, { tipo: t })}`} aria-current={f.tipo === t ? 'page' : undefined} className={chip(f.tipo === t)}>
              {t ? ROTULO_TIPO_AGENTE[t] : 'Tipo: todos'}
            </Link>
          ))}
        </nav>
        <form role="search" action="/agentes" className="relative">
          {f.estado && <input type="hidden" name="estado" value={f.estado} />}
          {f.tipo && <input type="hidden" name="tipo" value={f.tipo} />}
          <Search aria-hidden size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={f.q} aria-label="Buscar agente" placeholder="Buscar agente" className="h-9 w-56 pl-8" />
        </form>
      </div>
    </div>
  );
}
