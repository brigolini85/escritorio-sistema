import { FileSpreadsheet } from 'lucide-react';
import { formatarHoraOuDia } from '@/lib/formatos';
import type { ResultadoArquivos } from '@/lib/resultados-assistente';
import { LinksCsv } from './links-csv';

/** Arquivos do Bling desta conversa, do mais novo para o mais antigo (só para quem tem "Corrigir e gerar"). */
export function PainelArquivos({ resultado }: { resultado: ResultadoArquivos }) {
  return (
    <article aria-labelledby="titulo-arquivos" className="rounded-lg border border-border bg-surface px-5 py-4">
      <h3 id="titulo-arquivos" className="mb-2 text-xs font-extrabold uppercase tracking-widest text-brand">Arquivos para o Bling</h3>
      <ul className="divide-y divide-border">
        {resultado.arquivos.map((a) => {
          const n = a.arquivo.chamados.length;
          return (
            <li key={a.mensagemId} className="flex flex-wrap items-center gap-3 py-3">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-success-soft text-success">
                <FileSpreadsheet size={20} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold text-foreground">{a.arquivo.nome}</span>
                <span className="block text-sm text-muted">{n === 1 ? '1 pedido' : `${n} pedidos`} · gerado {formatarHoraOuDia(a.em)}</span>
              </span>
              <LinksCsv mensagemId={a.mensagemId} arquivo={a.arquivo} onde="painel" variante="primary" />
            </li>
          );
        })}
      </ul>
    </article>
  );
}
