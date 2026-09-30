'use client';

import type { ReactNode } from 'react';
import { PainelLateralUrl } from '@/components/patterns/painel-lateral-url';
import { SheetBody, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Painel lateral da demanda aberta pela URL (?demanda=<id>): o endereço pode ser compartilhado.
 * Clique na linha: abre na hora com um esqueleto (evento da tabela) enquanto o servidor responde.
 * Fechar (Esc, X ou clique fora) tira o parâmetro da URL depois da animação e devolve o foco à linha.
 */
export function PainelDemanda({ demandaId, hrefFechar, children }: { demandaId: string | null; hrefFechar: string; children?: ReactNode }) {
  return (
    <PainelLateralUrl param="demanda" id={demandaId} hrefFechar={hrefFechar} esqueleto={<EsqueletoDemanda />}>
      {children}
    </PainelLateralUrl>
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
