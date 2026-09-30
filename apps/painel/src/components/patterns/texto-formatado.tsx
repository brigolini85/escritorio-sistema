import { Fragment } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { blocosDoTexto, trechosDoTexto } from '@/lib/texto-assistente';

/** Valor, quantidade ou porcentagem: alinhado à direita, com números tabulares. */
const NUMERICO = /^-?(?:R\$\s*)?-?[\d.,]+\s*%?$/;

function Trechos({ texto }: { texto: string }) {
  return (
    <>
      {trechosDoTexto(texto).map((t, i) => (t.negrito ? <strong key={i} className="font-semibold">{t.texto}</strong> : <Fragment key={i}>{t.texto}</Fragment>))}
    </>
  );
}

/**
 * Texto de resposta do assistente com parágrafos (quebras de linha mantidas), títulos, listas e tabelas.
 * Monta os elementos a partir do texto; nunca injeta HTML.
 */
export function TextoFormatado({ texto, className }: { texto: string; className?: string }) {
  const blocos = blocosDoTexto(texto);
  return (
    <div className={cn('flex flex-col gap-2 break-words', className)}>
      {blocos.map((b, i) => {
        if (b.tipo === 'paragrafo') return <p key={i} className="whitespace-pre-wrap"><Trechos texto={b.texto} /></p>;
        if (b.tipo === 'titulo') return <p key={i} className="font-semibold"><Trechos texto={b.texto} /></p>;
        if (b.tipo === 'lista') {
          const Lista = b.ordenada ? 'ol' : 'ul';
          return (
            <Lista key={i} className={cn('flex flex-col gap-0.5 pl-5', b.ordenada ? 'list-decimal' : 'list-disc')}>
              {b.itens.map((item, n) => <li key={n} className="pl-0.5"><Trechos texto={item} /></li>)}
            </Lista>
          );
        }
        const numerica = b.cabecalho.map((_, c) => b.linhas.length > 0 && b.linhas.every((l) => !l[c] || NUMERICO.test(l[c]!)));
        return (
          <div key={i} className="overflow-hidden rounded-md border border-border bg-surface">
            <Table className="text-sm">
              <TableHeader className="bg-surface-muted">
                <TableRow className="hover:bg-transparent">
                  {b.cabecalho.map((c, n) => <TableHead key={n} className={cn('h-8', numerica[n] && 'text-right')}><Trechos texto={c} /></TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {b.linhas.map((l, r) => (
                  <TableRow key={r}>
                    {l.map((c, n) => (
                      <TableCell key={n} className={cn('h-8 py-1.5', numerica[n] && 'tabular whitespace-nowrap text-right')}><Trechos texto={c} /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
