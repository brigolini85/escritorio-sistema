'use client';

import { FileSpreadsheet, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { variantesBotao } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** Sem sinal de fim do download no navegador: o "Gerando…" some sozinho depois deste tempo. */
const CARREGANDO_MS = 6000;

/**
 * Link para a rota existente /api/csv-bling (?id=, os filtros da tela Demandas com ?parte=N, ou ?assistente=&parte=), com cara de botão.
 * É um link (role=link) e o nome acessível sempre contém "CSV Bling" (os testes procuram por ele).
 * Ao clicar, mostra "Gerando o arquivo…" enquanto o servidor monta o CSV.
 * `problemas`: pendências já conhecidas (problemasPedidoBling do core: qual pedido e qual campo falta).
 * Com pendência, o link não aparece; aparece a lista do que completar. A rota confere de novo de qualquer jeito.
 */
export function BlingExportButton({
  href,
  rotulo = 'Baixar CSV Bling',
  problemas = [],
  variante = 'outline',
  tamanho = 'sm',
  className,
}: {
  href: string;
  rotulo?: string;
  problemas?: string[];
  variante?: 'primary' | 'outline' | 'secondary' | 'link';
  tamanho?: 'sm' | 'md';
  className?: string;
}) {
  const [carregando, setCarregando] = useState(false);
  const idProblemas = useId();
  useEffect(() => {
    if (!carregando) return;
    const id = setTimeout(() => setCarregando(false), CARREGANDO_MS);
    return () => clearTimeout(id);
  }, [carregando]);

  if (problemas.length > 0) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <span
          role="button"
          aria-disabled="true"
          aria-describedby={idProblemas}
          className={cn(variantesBotao({ variant: variante === 'link' ? 'outline' : variante, size: tamanho }), 'cursor-not-allowed opacity-50')}
        >
          <FileSpreadsheet aria-hidden size={16} strokeWidth={1.75} />
          {rotulo}
        </span>
        <div id={idProblemas} className="rounded-md border border-border bg-warning-soft p-3 text-sm text-warning">
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
            Complete antes de gerar o arquivo:
          </p>
          <ul className="mt-1 list-disc pl-6">
            {problemas.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <a
        href={href}
        onClick={() => setCarregando(true)}
        aria-busy={carregando || undefined}
        className={cn(variantesBotao({ variant: variante, size: tamanho }), carregando && 'cursor-progress')}
      >
        {carregando
          ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" />
          : <FileSpreadsheet aria-hidden size={16} strokeWidth={1.75} />}
        {rotulo}
      </a>
      <span role="status" className="text-sm text-muted">{carregando ? 'Gerando o arquivo…' : ''}</span>
    </span>
  );
}
