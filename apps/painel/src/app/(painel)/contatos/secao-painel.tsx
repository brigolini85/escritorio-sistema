import type { ReactNode } from 'react';

/** Uma seção do painel do contato (região com nome, para leitor de tela e testes). A Parte H acrescenta a sua (D18). */
export function SecaoPainel({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  // Componente de servidor: id fixo a partir do título (cada título aparece uma vez no painel).
  const id = `secao-${titulo.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-xs font-bold uppercase tracking-wide text-brand">{titulo}</h3>
        {extra && <span className="text-sm text-muted">{extra}</span>}
      </div>
      {children}
    </section>
  );
}
