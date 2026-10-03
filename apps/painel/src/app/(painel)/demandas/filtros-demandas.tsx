'use client';

import { Filter, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { classeSelect } from '../clientes/estilos';

const ESPERA_MS = 300;

/** Busca sempre visível (spec 6.1): nº, empresa, título ou descrição. Fica na URL (?q=) e volta à página 1. */
export function BuscaDemandas({ inicial }: { inicial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [texto, setTexto] = useState(inicial);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => setTexto(inicial), [inicial]);

  const aplicar = (valor: string) => {
    clearTimeout(espera.current);
    const p = new URLSearchParams(sp.toString());
    if (valor.trim()) p.set('q', valor.trim()); else p.delete('q');
    p.delete('pagina');
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-md">
      <Search aria-hidden size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <Input
        type="search"
        aria-label="Buscar demandas"
        placeholder="Nº, empresa ou assunto"
        value={texto}
        className="pl-9"
        onChange={(e) => {
          setTexto(e.target.value);
          clearTimeout(espera.current);
          const valor = e.target.value;
          espera.current = setTimeout(() => aplicar(valor), ESPERA_MS);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') aplicar(texto); }}
      />
    </div>
  );
}

type Opcao = { valor: string; rotulo: string };

/**
 * "Filtrar" (botão grafite, imagem 03): Setor, Responsável, Prioridade, Tipo e Período numa janelinha.
 * Aplicar troca só esses parâmetros na URL; busca, status, origem, vencidas e ordem continuam (`manter`).
 */
export function FiltrarDemandas({ manter, setores, responsaveis, valores }: {
  manter: [string, string][];
  setores: Opcao[];
  responsaveis: Opcao[];
  valores: { setor: string; responsavel: string; prioridade: string; tipo: string; periodo: string };
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const id = useId();

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const p = new URLSearchParams(manter);
    for (const [k, v] of new FormData(e.currentTarget)) if (typeof v === 'string' && v) p.set(k, v);
    setAberto(false);
    router.push(`/demandas?${p.toString()}`, { scroll: false });
  };

  const campo = (nome: keyof typeof valores, rotulo: string, opcoes: Opcao[]) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${nome}`} className="text-xs font-bold uppercase tracking-wide text-brand">{rotulo}</label>
      <select id={`${id}-${nome}`} name={nome} defaultValue={valores[nome]} className={classeSelect}>
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    </div>
  );

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="grafite"><Filter aria-hidden size={16} strokeWidth={1.75} />Filtrar</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form onSubmit={enviar} className="grid gap-3">
          {campo('setor', 'Setor', [{ valor: '', rotulo: 'Todos' }, ...setores, { valor: 'triagem', rotulo: 'Triagem' }])}
          {campo('responsavel', 'Responsável', [{ valor: '', rotulo: 'Qualquer um' }, { valor: 'eu', rotulo: 'Comigo' }, { valor: 'sem', rotulo: 'Sem responsável' }, ...responsaveis])}
          {campo('prioridade', 'Prioridade', [{ valor: '', rotulo: 'Todas' }, { valor: 'urgente', rotulo: 'Urgente' }, { valor: 'alta', rotulo: 'Alta' }, { valor: 'normal', rotulo: 'Normal' }, { valor: 'baixa', rotulo: 'Baixa' }])}
          {campo('tipo', 'Tipo', [{ valor: '', rotulo: 'Todos' }, { valor: 'venda', rotulo: 'Pedido de nota (venda)' }, { valor: 'outras', rotulo: 'Outras' }])}
          {campo('periodo', 'Aberta', [{ valor: '', rotulo: 'Qualquer data' }, { valor: 'hoje', rotulo: 'Hoje' }, { valor: '7d', rotulo: 'Últimos 7 dias' }, { valor: '30d', rotulo: 'Últimos 30 dias' }])}
          <Button type="submit" size="sm">Aplicar</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
