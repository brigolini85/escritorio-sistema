'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { EVENTO_ABRIR_LINHA, type LinhaAbrindo } from '@/components/patterns/data-table-cliente';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Painel lateral da demanda aberta pela URL (?demanda=<id>): o endereço pode ser compartilhado.
 * Clique na linha: abre na hora com um esqueleto (evento da tabela) enquanto o servidor responde.
 * Fechar (Esc, X ou clique fora) tira o parâmetro da URL depois da animação e devolve o foco à linha.
 */
export function PainelDemanda({ demandaId, hrefFechar, children }: { demandaId: string | null; hrefFechar: string; children?: ReactNode }) {
  const router = useRouter();
  const [pendente, setPendente] = useState<string | null>(null);
  const [fechando, setFechando] = useState(false);

  useEffect(() => {
    const aoAbrir = (e: Event) => {
      const { href } = (e as CustomEvent<LinhaAbrindo>).detail;
      const id = new URL(href, window.location.href).searchParams.get('demanda');
      if (!id) return;
      setPendente(id);
      setFechando(false);
    };
    window.addEventListener(EVENTO_ABRIR_LINHA, aoAbrir);
    return () => window.removeEventListener(EVENTO_ABRIR_LINHA, aoAbrir);
  }, []);

  // O servidor respondeu com a demanda pedida (ou outra, por voltar/avançar): o conteúdo real substitui o esqueleto.
  useEffect(() => {
    setPendente((p) => (p && p === demandaId ? null : p));
    if (demandaId) setFechando(false);
  }, [demandaId]);

  const carregando = pendente !== null && pendente !== demandaId;
  const aberto = Boolean(pendente ?? demandaId) && !fechando;

  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        if (v) return;
        setFechando(true);
        setPendente(null);
        if (demandaId) setTimeout(() => router.replace(hrefFechar, { scroll: false }), 150);
      }}
    >
      <SheetContent
        className="w-full gap-0 sm:max-w-2xl"
        onCloseAutoFocus={(e) => {
          // Aberto pela URL, não há gatilho: o foco volta para a linha da demanda (ainda marcada como atual).
          e.preventDefault();
          document.querySelector<HTMLElement>('tr[aria-current="true"]')?.focus();
        }}
      >
        {carregando || !children ? <EsqueletoDemanda /> : children}
      </SheetContent>
    </Sheet>
  );
}

/** Formato do painel enquanto os dados chegam (também é o fallback do Suspense do detalhe). */
export function EsqueletoDemanda() {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="sr-only">Carregando a demanda</SheetTitle>
        <SheetDescription className="sr-only">Os detalhes aparecem em instantes.</SheetDescription>
        <Skeleton className="h-6 w-2/3" />
        <div className="flex gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-24" /></div>
      </SheetHeader>
      <SheetBody role="status" aria-label="Carregando a demanda" className="flex flex-col gap-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex flex-col gap-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-32" /></div>)}
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </SheetBody>
    </>
  );
}
