import { CircleAlert, Split } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { barraDoSetor, hrefDoSetor, separarSetores, textoSemAbertas, type LinhaSetor } from '@/lib/inicio';
import { lerSetoresSituacao } from './dados-situacao';

const zero = 'text-subtle';
const celula = 'tabular px-2 py-3 text-right text-base';

/** "Demandas por setor" (imagem A): uma linha por setor com abertas e a Triagem; setores sem nenhuma vão para a nota. */
export async function TabelaSetores() {
  const linhas = await lerSetoresSituacao();
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-setores" className="text-sm font-bold uppercase tracking-wide text-brand">Demandas por setor</h2>
        <span className="text-sm text-subtle">clique no setor para abrir a lista filtrada</span>
      </div>
      {linhas === null ? (
        <p className="text-sm text-muted">Demandas por setor indisponíveis agora: falta a atualização do banco ou a leitura falhou.</p>
      ) : (
        <Corpo linhas={linhas} />
      )}
    </Card>
  );
}

function Corpo({ linhas }: { linhas: LinhaSetor[] }) {
  const { visiveis, semAbertas } = separarSetores(linhas);
  const maior = Math.max(0, ...visiveis.map((l) => l.abertas));
  const nota = textoSemAbertas(semAbertas);
  return (
    <>
      {visiveis.length === 0 ? <p className="text-sm text-muted">Nenhuma demanda aberta.</p> : (
        <div className="overflow-x-auto">
          <table aria-labelledby="titulo-setores" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-bold uppercase tracking-wide text-muted">
                <th scope="col" className="px-2 py-2 text-left">Setor</th>
                <th scope="col" className="px-2 py-2 text-left">Situação</th>
                <th scope="col" className="px-2 py-2 text-right">Abertas</th>
                <th scope="col" className="px-2 py-2 text-right">Vencem hoje</th>
                <th scope="col" className="px-2 py-2 text-right">Vencidas</th>
                <th scope="col" className="px-2 py-2 text-right">Sem responsável</th>
                <th scope="col" className="px-2 py-2 text-right">Urgentes</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const b = barraDoSetor(l, maior);
                const triagem = l.setorId === null;
                return (
                  <tr key={l.setorId ?? 'triagem'} className="border-b border-border last:border-b-0">
                    <th scope="row" className="px-2 py-3 text-left font-bold">
                      <Link href={hrefDoSetor(l.setorId)} className={cn('inline-flex items-center gap-1 hover:underline', triagem ? 'text-brand' : 'text-foreground')}>
                        {triagem && <Split aria-hidden size={14} strokeWidth={1.75} />}{l.setor}
                      </Link>
                    </th>
                    <td className="w-1/4 px-2 py-3">
                      <div role="img" aria-label={b.rotulo} className="flex h-2.5 w-full overflow-hidden rounded-sm bg-surface-muted">
                        <span className="h-full bg-success" style={{ width: `${b.noPrazo}%` }} />
                        <span className="h-full bg-warning-decor" style={{ width: `${b.venceHoje}%` }} />
                        <span className="h-full bg-danger" style={{ width: `${b.vencida}%` }} />
                      </div>
                    </td>
                    <td className={cn(celula, 'font-bold text-foreground')}>{l.abertas}</td>
                    <td className={cn(celula, l.vencemHoje > 0 ? 'font-bold text-warning' : zero)}>{l.vencemHoje}</td>
                    <td className={cn(celula, l.vencidas > 0 ? 'font-bold text-danger' : zero)}>
                      <span className="inline-flex items-center justify-end gap-1">
                        {l.vencidas > 0 && <CircleAlert aria-hidden size={14} strokeWidth={2} />}{l.vencidas}
                      </span>
                    </td>
                    <td className={cn(celula, l.semResponsavel > 0 ? 'text-foreground' : zero)}>{l.semResponsavel}</td>
                    <td className={cn(celula, l.urgentes > 0 ? 'font-bold text-danger' : zero)}>{l.urgentes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1"><span aria-hidden className="size-3 rounded-sm bg-success" />no prazo</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden className="size-3 rounded-sm bg-warning-decor" />vence hoje</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden className="size-3 rounded-sm bg-danger" />vencida</span>
        {nota && <span className="text-subtle">{nota}</span>}
      </p>
    </>
  );
}
