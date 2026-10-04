import { ArrowDownUp } from 'lucide-react';
import Link from 'next/link';
import { FilterBar } from '@/components/patterns/filter-bar';
import { cn } from '@/lib/cn';
import { FILTROS_RAPIDOS, PERIODOS_CONTATO, type FiltrosContatos } from '@/lib/contatos';
import { hrefComParams, type Ordem, type ParamsBusca } from '@/lib/tabela-url';
import type { Contagens } from './dados-contatos';

const chip = 'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-base transition-colors duration-150 ease-out';
const ligado = 'border-grafite bg-grafite text-grafite-foreground';
const desligado = 'border-input bg-surface text-foreground hover:bg-surface-muted';

/**
 * Busca (nome, telefone ou empresa), empresa e período na FilterBar; filtros rápidos com contagem (exclusivos, D4) e a ordem.
 * Sem a visão no banco (D14): só a busca, com o aviso.
 */
export function BarraContatos({ params, f, contagens, empresas, ordem, completa }: {
  params: ParamsBusca; f: FiltrosContatos; contagens: Contagens | null; empresas: { id: string; nome: string }[]; ordem: Ordem; completa: boolean;
}) {
  const href = (m: Record<string, string | null>) => `/contatos${hrefComParams(params, { ...m, contato: null, editar: null })}`;
  const porNome = ordem.coluna === 'nome';
  const opcoes = [{ valor: null, rotulo: 'Todos' }, ...FILTROS_RAPIDOS];
  return (
    <div className="mb-3 flex flex-col gap-3">
      <FilterBar
        busca={{ placeholder: 'Nome, telefone ou empresa', rotulo: 'Buscar por nome, telefone ou empresa' }}
        filtros={completa ? [
          { param: 'empresa', rotulo: 'Empresa', todos: 'todas', opcoes: empresas.map((e) => ({ valor: e.id, rotulo: e.nome })) },
          { param: 'periodo', rotulo: 'Último contato', todos: 'qualquer data', opcoes: PERIODOS_CONTATO.map((p) => ({ valor: p.valor, rotulo: p.rotulo })) },
        ] : []}
      />
      {!completa && (
        <p role="status" className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-muted">
          Lista pelo nome, sem filtros rápidos, empresa e período: falta a atualização do banco desta versão. A busca por nome ou telefone funciona.
        </p>
      )}
      {completa && contagens && (
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Filtros rápidos" className="flex flex-wrap items-center gap-2">
            {opcoes.map((o) => {
              const ativo = f.rapido === o.valor;
              return (
                <Link key={o.valor ?? 'todos'} href={href({ filtro: o.valor })} scroll={false} aria-current={ativo ? 'true' : undefined}
                  data-filtro={o.valor ?? 'todos'} className={cn(chip, ativo ? ligado : desligado)}>
                  {o.rotulo}<strong data-contagem className="tabular">{contagens[o.valor ?? 'todos']}</strong>
                </Link>
              );
            })}
          </nav>
          <Link href={href(porNome ? { ordem: null, direcao: null } : { ordem: 'nome', direcao: 'asc' })} scroll={false}
            className="ml-auto inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
            <ArrowDownUp aria-hidden size={14} strokeWidth={1.75} />
            Ordem: {porNome ? 'nome' : 'último contato'}
          </Link>
        </div>
      )}
    </div>
  );
}
