'use client';

import { Building2, ClipboardList, Contact, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MINIMO_BUSCA, type ItemBusca, type ResultadoBusca } from '@/lib/busca';
import { cn } from '@/lib/cn';
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const GRUPOS = [
  { chave: 'empresas', titulo: 'Empresas', Icone: Building2 },
  { chave: 'contatos', titulo: 'Contatos', Icone: Contact },
  { chave: 'demandas', titulo: 'Demandas', Icone: ClipboardList },
] as const;

function total(r: ResultadoBusca): number {
  return r.empresas.length + r.contatos.length + r.demandas.length;
}

/**
 * Busca global da barra do topo: Ctrl/Cmd + K abre; resultados vêm de /api/busca (RLS do usuário).
 * Mensagens de estado ficam fora da lista (role=listbox só tem opções) numa região aria-live;
 * o resultado anterior continua na tela enquanto o novo é buscado.
 */
export function BuscaGlobal({ className }: { className?: string }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState('');
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [mac, setMac] = useState(false);
  // Item destacado: volta para o primeiro sempre que chega resultado novo (senão Enter não faz nada).
  const [selecionado, setSelecionado] = useState('');

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

  const termo = q.trim();
  const curto = termo.length < MINIMO_BUSCA;

  useEffect(() => {
    if (curto) {
      setResultado(null);
      setBuscando(false);
      setErro(false);
      return;
    }
    setBuscando(true);
    const controle = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(termo)}`, { signal: controle.signal });
        if (!r.ok) throw new Error(String(r.status));
        const dados = (await r.json()) as ResultadoBusca;
        if (controle.signal.aborted) return;
        setResultado(dados);
        const primeiro = GRUPOS.find((g) => dados[g.chave].length > 0);
        setSelecionado(primeiro ? `${primeiro.chave}-${dados[primeiro.chave][0]!.id}` : '');
        setErro(false);
        setBuscando(false);
      } catch {
        if (controle.signal.aborted) return;
        setErro(true);
        setBuscando(false);
      }
    }, 250);
    return () => {
      clearTimeout(espera);
      controle.abort();
    };
  }, [termo, curto, tentativa]);

  function mudarAberta(v: boolean) {
    setAberta(v);
    if (!v) setQ('');
  }

  function ir(item: ItemBusca) {
    mudarAberta(false);
    router.push(item.href);
  }

  const n = resultado ? total(resultado) : 0;
  let aviso: string;
  if (curto) aviso = 'Digite pelo menos 2 letras ou números.';
  else if (erro) aviso = 'Não foi possível buscar agora.';
  else if (buscando && !resultado) aviso = 'Buscando…';
  else if (resultado && n === 0) aviso = `Nada encontrado para “${termo}”.`;
  else if (resultado) aviso = n === 1 ? '1 resultado' : `${n} resultados`;
  else aviso = '';
  // Com resultados na tela, a contagem só vai para o leitor de tela; os outros avisos aparecem.
  const avisoVisivel = !(resultado && n > 0 && !erro);

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
      <CommandDialog open={aberta} onOpenChange={mudarAberta} shouldFilter={false} value={selecionado} onValueChange={setSelecionado} titulo="Buscar" descricao="Busque empresas, contatos e demandas.">
        <CommandInput value={q} onValueChange={setQ} placeholder="Empresa, contato, CNPJ, telefone ou #número da demanda" aria-label="Buscar empresa, contato ou demanda" />
        <div className="relative">
          {/* Linha fina no topo enquanto busca com resultados já na tela */}
          {buscando && resultado && <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-brand" />}
          <div
            aria-live="polite"
            className={cn(avisoVisivel ? 'flex flex-col items-center gap-2 py-6 text-center text-sm text-muted' : 'sr-only')}
          >
            {aviso}
            {erro && (
              <button type="button" onClick={() => setTentativa((t) => t + 1)} className="cursor-pointer text-brand underline-offset-4 hover:underline">
                Tentar de novo
              </button>
            )}
          </div>
          {resultado && n > 0 && !erro && (
            <CommandList aria-busy={buscando}>
              {GRUPOS.map(({ chave, titulo, Icone }) => resultado[chave].length > 0 && (
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
          )}
        </div>
      </CommandDialog>
    </>
  );
}
