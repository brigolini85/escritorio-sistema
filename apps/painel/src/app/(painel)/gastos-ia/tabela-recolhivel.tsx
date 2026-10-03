'use client';

import { useState, type ReactNode } from 'react';

/**
 * "Ver em tabela": recolhida, a tabela só some da vista (sr-only) e o leitor de tela continua lendo, já que o gráfico é aria-hidden.
 * Aberta, a caixa rola (max-h) e por isso entra na ordem do Tab, com nome; fechada não vira parada invisível do Tab.
 */
export function TabelaRecolhivel({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <details className="mt-3 text-sm" onToggle={(e) => setAberta(e.currentTarget.open)}>
        <summary className="w-max cursor-pointer text-brand underline-offset-4 hover:underline">Ver em tabela</summary>
      </details>
      <div
        {...(aberta ? { tabIndex: 0, role: 'region', 'aria-label': rotulo } : {})}
        className={aberta ? 'mt-2 block max-h-64 overflow-y-auto text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : 'sr-only text-sm'}
      >
        {children}
      </div>
    </>
  );
}
