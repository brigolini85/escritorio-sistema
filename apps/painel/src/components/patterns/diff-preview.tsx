import { Minus, PenLine, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { compararPrevia, interpretarPrevias, type LinhaComparada, type Mudanca, type PreviaInterpretada } from '@/lib/previa-pedido';

/**
 * Prévia antes → depois do assistente para correção de pedido. Recebe o texto que o assistente já escreve
 * ("Antes:" / "Depois:" com linhas "• …"). Adicionado em verde, removido em vermelho riscado, alterado com o
 * valor antigo ao lado. A mudança também vai em texto para leitor de tela (nunca só cor).
 * Texto fora do formato aparece como veio.
 */

const ESTILO: Record<Mudanca, { linha: string; Icone: typeof Plus | null; rotulo: string }> = {
  igual: { linha: 'text-foreground', Icone: null, rotulo: '' },
  adicionado: { linha: 'bg-success-soft text-success', Icone: Plus, rotulo: 'Adicionado: ' },
  removido: { linha: 'bg-danger-soft text-danger', Icone: Minus, rotulo: 'Removido: ' },
  alterado: { linha: 'bg-warning-soft text-warning', Icone: PenLine, rotulo: 'Alterado: ' },
};

/** Valor novo com o antigo riscado ao lado quando mudou. */
function Valor({ atual, anterior, mudou }: { atual: ReactNode; anterior: ReactNode; mudou: boolean }) {
  if (!mudou) return <>{atual}</>;
  return (
    <>
      <ins className="no-underline">{atual}</ins>{' '}
      <span className="whitespace-nowrap">(antes: <del>{anterior}</del>)</span>
    </>
  );
}

function Conteudo({ l }: { l: LinhaComparada }) {
  if (l.tipo === 'texto') return <>{l.texto}</>;
  if (l.tipo === 'campo') {
    return (
      <>
        <span className="font-medium">{l.rotulo}:</span>{' '}
        {l.mudanca === 'removido' ? <del>{l.valor}</del> : <Valor atual={l.valor} anterior={l.anterior} mudou={l.anterior !== null} />}
      </>
    );
  }
  const { item: i, anterior: a, alteracoes: m } = l;
  const nome = `${i.produto}${i.codigo ? ` (cód. ${i.codigo})` : ''}`;
  if (l.mudanca === 'removido') return <del>{i.texto}</del>;
  return (
    <>
      <span className="tabular">
        <Valor atual={`${i.quantidade} ${i.unidade}`} anterior={a ? `${a.quantidade} ${a.unidade}` : null} mudou={!!m && (m.quantidade || m.unidade)} />
      </span>{' '}
      <Valor atual={nome} anterior={a ? `${a.produto}${a.codigo ? ` (cód. ${a.codigo})` : ''}` : null} mudou={!!m?.produto} />
      {' · '}
      {i.semPreco ? (
        <Valor atual="sem preço" anterior={a?.preco} mudou={!!m?.preco} />
      ) : (
        <span className="tabular">
          <Valor atual={i.preco} anterior={a?.preco ?? 'sem preço'} mudou={!!m?.preco} />
          {' = '}
          <Valor atual={i.subtotal} anterior={a?.subtotal ?? '—'} mudou={!!m?.subtotal} />
        </span>
      )}
    </>
  );
}

/** Texto em volta da prévia (cabeçalho, rodapé). Padrão: como veio, com as quebras de linha. */
type FormatarTexto = (texto: string) => ReactNode;
const textoPuro: FormatarTexto = (t) => <p className="whitespace-pre-wrap">{t}</p>;

/**
 * `formatarTexto`: como mostrar o texto em volta das prévias (a tela do Assistente formata listas e tabelas
 * da resposta). Sem ele, texto puro. Só funciona em componente de servidor ou dentro de um client.
 */
export function DiffPreview({ texto, className, formatarTexto = textoPuro }: { texto: string; className?: string; formatarTexto?: FormatarTexto }) {
  const previas = interpretarPrevias(texto);
  if (!previas) return <div className={className}>{formatarTexto(texto)}</div>;
  // Uma resposta pode trazer uma prévia por pedido: cada uma com a sua comparação.
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {previas.map((p, i) => <UmaPrevia key={i} previa={p} formatarTexto={formatarTexto} />)}
    </div>
  );
}

function UmaPrevia({ previa, formatarTexto }: { previa: PreviaInterpretada; formatarTexto: FormatarTexto }) {
  const linhas = compararPrevia(previa);
  const resumo = (['alterado', 'adicionado', 'removido'] as const)
    .map((m) => {
      const n = linhas.filter((l) => l.mudanca === m).length;
      return n ? `${n} ${m}${n === 1 ? '' : 's'}` : '';
    })
    .filter(Boolean).join(', ') || 'Nenhuma mudança';

  return (
    <div className="flex flex-col gap-2">
      {previa.cabecalho && <div className="font-medium">{formatarTexto(previa.cabecalho)}</div>}
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <p className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-1.5 text-xs font-medium text-muted">
          <span>Antes → depois</span>
          <span>{resumo}</span>
        </p>
        <ul className="divide-y divide-border text-sm">
          {linhas.map((l, n) => {
            const e = ESTILO[l.mudanca];
            const Icone = e.Icone;
            return (
              <li key={n} className={cn('flex items-start gap-2 px-3 py-1.5', e.linha)}>
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  {Icone && <Icone aria-hidden size={14} strokeWidth={2} />}
                </span>
                <span className="min-w-0 break-words">
                  {e.rotulo && <span className="sr-only">{e.rotulo}</span>}
                  <Conteudo l={l} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {previa.rodape && <div>{formatarTexto(previa.rodape)}</div>}
    </div>
  );
}
