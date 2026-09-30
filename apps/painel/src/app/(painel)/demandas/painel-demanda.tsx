'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';

/**
 * Painel lateral da demanda aberta pela URL (?demanda=<id>): o endereço pode ser compartilhado.
 * Fechar (Esc, X ou clique fora) tira o parâmetro da URL depois da animação e devolve o foco à linha.
 */
export function PainelDemanda({ hrefFechar, children }: { hrefFechar: string; children: ReactNode }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(true);
  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        if (v) return;
        setAberto(false);
        setTimeout(() => router.replace(hrefFechar, { scroll: false }), 150);
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
        {children}
      </SheetContent>
    </Sheet>
  );
}
