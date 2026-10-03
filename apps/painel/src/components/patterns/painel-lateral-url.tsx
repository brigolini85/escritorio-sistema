'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EVENTO_ABRIR_LINHA, type LinhaAbrindo } from '@/components/patterns/data-table-cliente';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useDescarteProtegido } from '@/components/patterns/formulario-alteravel';
import { cn } from '@/lib/cn';

/** Sem resposta do servidor neste tempo (navegação cancelada ou falhou), o esqueleto sai e o painel volta ao que a URL diz. */
const ESPERA_MAXIMA_MS = 15_000;

/**
 * Painel lateral (Sheet) aberto pela URL (?<param>=<id>): o endereço pode ser compartilhado.
 * Clique na linha da DataTable (hrefLinha): abre na hora com o `esqueleto` (evento da tabela) enquanto o servidor responde.
 * Fechar (Esc, X ou clique fora) tira o parâmetro da URL depois da animação e devolve o foco à linha.
 * O esqueleto nunca fica preso: sai quando a URL muda para o id pedido, quando o navegador volta/avança,
 * quando se clica na linha que já está aberta e depois de ESPERA_MAXIMA_MS.
 */
export function PainelLateralUrl({
  param,
  id,
  hrefFechar,
  esqueleto,
  className,
  protegerAlteracoes = false,
  children,
}: {
  param: string;
  id: string | null;
  hrefFechar: string;
  esqueleto: ReactNode;
  className?: string;
  /** Com formulário alterado dentro, fechar (Esc, X, clique fora) pergunta antes de descartar. */
  protegerAlteracoes?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [pendente, setPendente] = useState<string | null>(null);
  const [fechando, setFechando] = useState(false);
  const atual = useRef(id);
  const conteudo = useRef<HTMLDivElement>(null);
  const { tentarFechar, janela } = useDescarteProtegido();

  useEffect(() => {
    const aoAbrir = (e: Event) => {
      const { href } = (e as CustomEvent<LinhaAbrindo>).detail;
      const pedido = new URL(href, window.location.href).searchParams.get(param);
      if (!pedido) return;
      setFechando(false);
      // A linha que já está aberta: nada a esperar.
      setPendente(pedido === atual.current ? null : pedido);
    };
    // Voltar/avançar: a URL manda; o que estava sendo aberto deixa de valer.
    const aoVoltar = () => setPendente(null);
    window.addEventListener(EVENTO_ABRIR_LINHA, aoAbrir);
    window.addEventListener('popstate', aoVoltar);
    return () => {
      window.removeEventListener(EVENTO_ABRIR_LINHA, aoAbrir);
      window.removeEventListener('popstate', aoVoltar);
    };
  }, [param]);

  // O servidor respondeu com o id pedido: o conteúdo real substitui o esqueleto.
  useEffect(() => {
    atual.current = id;
    setPendente((p) => (p && p === id ? null : p));
    if (id) setFechando(false);
  }, [id]);

  useEffect(() => {
    if (!pendente) return;
    const t = setTimeout(() => setPendente(null), ESPERA_MAXIMA_MS);
    return () => clearTimeout(t);
  }, [pendente]);

  const carregando = pendente !== null && pendente !== id;
  const aberto = Boolean(pendente ?? id) && !fechando;

  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        if (v) return;
        const fechar = () => {
          setFechando(true);
          setPendente(null);
          if (id) setTimeout(() => router.replace(hrefFechar, { scroll: false }), 150);
        };
        if (protegerAlteracoes) tentarFechar(conteudo.current, fechar);
        else fechar();
      }}
    >
      <SheetContent
        ref={conteudo}
        className={cn('w-full gap-0 sm:max-w-2xl', className)}
        onCloseAutoFocus={(e) => {
          // Aberto pela URL, não há gatilho: o foco volta para a linha (ainda marcada como atual).
          e.preventDefault();
          // Telas sem DataTable (ranking de Gastos com IA) marcam o link com data-foco-painel=<param> e aria-current.
          (document.querySelector<HTMLElement>('tr[aria-current="true"]') ?? document.querySelector<HTMLElement>(`[data-foco-painel="${param}"][aria-current="true"]`))?.focus();
        }}
      >
        {carregando || !children ? esqueleto : children}
        {janela}
      </SheetContent>
    </Sheet>
  );
}
