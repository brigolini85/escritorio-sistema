import { TabelaDoTexto } from '@/components/patterns/texto-formatado';
import { formatarHora } from '@/lib/formatos';
import type { ResultadoTabela } from '@/lib/resultados-assistente';

export function PainelTabela({ resultado }: { resultado: ResultadoTabela }) {
  return (
    <article aria-labelledby="titulo-tabela" className="rounded-lg border border-border bg-surface">
      <header className="border-b border-border px-5 py-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-brand">Tabela · resposta das {formatarHora(resultado.em)}</p>
        <h3 id="titulo-tabela" className="text-2xl font-light text-foreground">{resultado.titulo}</h3>
      </header>
      <div className="p-4"><TabelaDoTexto tabela={resultado.tabela} /></div>
    </article>
  );
}
