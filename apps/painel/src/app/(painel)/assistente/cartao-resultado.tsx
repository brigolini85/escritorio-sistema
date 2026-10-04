import { ArrowRight, FileSpreadsheet, GitCompare, Table2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { Cartao } from '@/lib/resultados-assistente';
import { LinksCsv } from './links-csv';

const ESTILO: Record<Cartao['tipo'], { Icone: typeof Table2; faixa: string }> = {
  pedido: { Icone: GitCompare, faixa: 'border-l-warning-decor bg-warning-soft' },
  tabela: { Icone: Table2, faixa: 'border-l-info bg-info-soft' },
  arquivo: { Icone: FileSpreadsheet, faixa: 'border-l-success bg-success-soft' },
};

/** Cartão "VER AO LADO" no balão (D8): o conteúdo grande abre no painel de resultado. O arquivo traz também os links. */
export function CartaoResultado({ cartao, href, ativo }: { cartao: Cartao; href: string; ativo: boolean }) {
  const e = ESTILO[cartao.tipo];
  return (
    <div className={cn('flex flex-col gap-2 rounded-md border border-l-4 border-border px-2.5 py-2 text-sm', e.faixa)}>
      <div className="flex items-center gap-2.5">
        <e.Icone aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-foreground">{cartao.rotulo}</span>
        <Link
          href={href}
          scroll={false}
          aria-current={ativo ? 'true' : undefined}
          aria-label={`Ver ao lado: ${cartao.rotulo}`}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-brand underline-offset-4 hover:underline"
        >
          Ver ao lado
          <ArrowRight aria-hidden size={14} strokeWidth={2} />
        </Link>
      </div>
      {cartao.tipo === 'arquivo' && <LinksCsv mensagemId={cartao.mensagemId} arquivo={cartao.arquivo} onde="conversa" variante="link" />}
    </div>
  );
}
