'use client';

import { Building2, ClipboardList, Contact, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MINIMO_BUSCA, type ItemBusca, type ResultadoBusca } from '@/lib/busca';
import { cn } from '@/lib/cn';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

type Estado =
  | { tipo: 'ocioso' }
  | { tipo: 'buscando' }
  | { tipo: 'pronto'; resultado: ResultadoBusca }
  | { tipo: 'erro' };

const GRUPOS = [
  { chave: 'empresas', titulo: 'Empresas', Icone: Building2 },
  { chave: 'contatos', titulo: 'Contatos', Icone: Contact },
  { chave: 'demandas', titulo: 'Demandas', Icone: ClipboardList },
] as const;

/** Busca global da barra do topo: Ctrl/Cmd + K abre; resultados vêm de /api/busca (RLS do usuário). */
export function BuscaGlobal({ className }: { className?: string }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'ocioso' });
  const [tentativa, setTentativa] = useState(0);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    function atalho(e: KeyboardEvent) {
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setAberta((a) => !a);
      }
    }
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, []);

  useEffect(() => {
    const termo = q.trim();
    if (termo.length < MINIMO_BUSCA) {
      setEstado({ tipo: 'ocioso' });
      return;
    }
    setEstado({ tipo: 'buscando' });
    const controle = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(termo)}`, { signal: controle.signal });
        if (!r.ok) throw new Error(String(r.status));
        setEstado({ tipo: 'pronto', resultado: (await r.json()) as ResultadoBusca });
      } catch (e) {
        if (!controle.signal.aborted) setEstado({ tipo: 'erro' });
      }
    }, 250);
    return () => {
      clearTimeout(espera);
      controle.abort();
    };
  }, [q, tentativa]);

  function mudarAberta(v: boolean) {
    setAberta(v);
    if (!v) setQ('');
  }

  function ir(item: ItemBusca) {
    mudarAberta(false);
    router.push(item.href);
  }

  const resultado = estado.tipo === 'pronto' ? estado.resultado : null;
  const vazio = resultado && GRUPOS.every((g) => resultado[g.chave].length === 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
        className={cn(
          'inline-flex h-9 w-full max-w-sm cursor-pointer items-center gap-2 rounded-md border border-input bg-surface px-3 text-base text-subtle transition-colors duration-150 ease-out hover:bg-surface-muted',
          className,
        )}
      >
        <Search aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
        <span className="flex-1 truncate text-left">Buscar</span>
        <kbd aria-hidden className="hidden rounded-sm border border-border bg-surface-muted px-1.5 font-sans text-xs text-muted sm:inline">
          {mac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>
      <CommandDialog open={aberta} onOpenChange={mudarAberta} shouldFilter={false} titulo="Buscar" descricao="Busque empresas, contatos e demandas.">
        <CommandInput value={q} onValueChange={setQ} placeholder="Empresa, contato, CNPJ, telefone ou #número da demanda" aria-label="Buscar empresa, contato ou demanda" />
        <CommandList>
          {estado.tipo === 'ocioso' && <p className="py-6 text-center text-sm text-muted">Digite pelo menos 2 letras ou números.</p>}
          {estado.tipo === 'buscando' && <p role="status" className="py-6 text-center text-sm text-muted">Buscando…</p>}
          {estado.tipo === 'erro' && (
            <div role="alert" className="flex flex-col items-center gap-2 py-6 text-sm text-muted">
              Não foi possível buscar agora.
              <button type="button" onClick={() => setTentativa((t) => t + 1)} className="cursor-pointer text-brand underline-offset-4 hover:underline">
                Tentar de novo
              </button>
            </div>
          )}
          {vazio && <CommandEmpty>Nada encontrado para “{q.trim()}”.</CommandEmpty>}
          {resultado && GRUPOS.map(({ chave, titulo, Icone }) => resultado[chave].length > 0 && (
            <CommandGroup key={chave} heading={titulo}>
              {resultado[chave].map((item) => (
                <CommandItem key={item.id} value={`${chave}-${item.id}`} onSelect={() => ir(item)}>
                  <Icone aria-hidden size={16} strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate">{item.titulo}</span>
                  {item.detalhe && <span className="ml-2 max-w-1/2 shrink truncate text-sm text-muted">{item.detalhe}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
