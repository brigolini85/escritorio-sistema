import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { hrefComParams, hrefOrdenar, PARAM_PAGINA, type Ordem, type Paginacao, type ParamsBusca } from '@/lib/tabela-url';
import { BotaoTentarDeNovo, CaixaSelecaoLinha, CaixaSelecaoTodas, LinhaTabela, SelecaoTabela } from './data-table-cliente';

export { BarraSelecao, CamposSelecionados, useSelecao } from './data-table-cliente';

/**
 * Tabela de dados das telas de lista (Demandas, Clientes, Contatos, Usuários).
 * Server-friendly: recebe linhas e colunas já prontas (a página lê searchParams, busca, ordena e pagina com
 * lib/tabela-url). Ordenação e página são links (funcionam sem JavaScript e ficam na URL).
 * Interativo no navegador: seleção múltipla (BarraSelecao + CamposSelecionados para ações em massa) e clique na linha.
 * Linhas de 40px. Na página (server component), use `hrefLinha`; `aoClicarLinha` só dentro de componente client.
 */

export type ColunaTabela<T> = {
  id: string;
  titulo: ReactNode;
  celula: (linha: T) => ReactNode;
  /** Cabeçalho vira link de ordenação (?ordem=id&direcao=asc|desc). */
  ordenavel?: boolean;
  alinhar?: 'esquerda' | 'direita';
  /** Deixa o texto quebrar em várias linhas (padrão: uma linha só, para a linha ficar com 40px). */
  quebrar?: boolean;
  /** Largura e afins, só com a escala (ex.: "w-16"). */
  className?: string;
};

type Props<T> = {
  /** Nome da tabela para leitor de tela, ex.: "Demandas abertas". */
  rotulo: string;
  linhas: readonly T[];
  colunas: readonly ColunaTabela<T>[];
  chave: (linha: T) => string;
  /** searchParams atuais: os links de ordem e página mantêm os filtros da tela. */
  params?: ParamsBusca;
  ordem?: Ordem | null;
  paginacao?: Paginacao;
  selecionavel?: boolean;
  /** Nome da caixa de seleção da linha, ex.: (d) => `Selecionar demanda #${d.numero}`. */
  rotuloSelecao?: (linha: T) => string;
  /** Aparece acima da tabela quando há linhas marcadas (use BarraSelecao / CamposSelecionados). */
  acoesEmMassa?: ReactNode;
  aoMudarSelecao?: (ids: string[]) => void;
  acoesLinha?: (linha: T) => ReactNode;
  hrefLinha?: (linha: T) => string;
  aoClicarLinha?: (linha: T) => void;
  /** Linha aberta no Sheet ao lado (destaque). */
  linhaAtiva?: string | null;
  /** Estado vazio (EmptyState com ação). */
  vazio?: ReactNode;
  /** Falha ao carregar: mensagem humana; o botão "Tentar de novo" recarrega os dados. */
  erro?: ReactNode;
  className?: string;
};

function Cabecalho<T>({ coluna, params, ordem }: { coluna: ColunaTabela<T>; params: ParamsBusca; ordem: Ordem | null }) {
  const direita = coluna.alinhar === 'direita';
  if (!coluna.ordenavel) return <TableHead className={cn(direita && 'text-right', coluna.className)}>{coluna.titulo}</TableHead>;
  const ativa = ordem?.coluna === coluna.id ? ordem.direcao : null;
  const Icone = ativa === 'asc' ? ArrowUp : ativa === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <TableHead aria-sort={ativa === 'asc' ? 'ascending' : ativa === 'desc' ? 'descending' : 'none'} className={cn(direita && 'text-right', coluna.className)}>
      <Link
        href={hrefOrdenar(params, ordem, coluna.id)}
        scroll={false}
        className={cn('inline-flex items-center gap-1 rounded-sm hover:text-foreground', ativa && 'text-foreground', direita && 'flex-row-reverse')}
      >
        {coluna.titulo}
        <Icone aria-hidden size={14} strokeWidth={1.75} className={cn(!ativa && 'text-subtle')} />
      </Link>
    </TableHead>
  );
}

export function DataTable<T>({
  rotulo, linhas, colunas, chave, params = {}, ordem = null, paginacao, selecionavel = false, rotuloSelecao, acoesEmMassa,
  aoMudarSelecao, acoesLinha, hrefLinha, aoClicarLinha, linhaAtiva = null, vazio, erro, className,
}: Props<T>) {
  const ids = linhas.map(chave);
  const totalColunas = colunas.length + (selecionavel ? 1 : 0) + (acoesLinha ? 1 : 0);

  const tabela = (
    <div className={cn('flex flex-col gap-2', className)}>
      {selecionavel && acoesEmMassa}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <Table aria-label={rotulo}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selecionavel && <TableHead className="w-10"><CaixaSelecaoTodas /></TableHead>}
              {colunas.map((c) => <Cabecalho key={c.id} coluna={c} params={params} ordem={ordem} />)}
              {acoesLinha && <TableHead className="w-12"><span className="sr-only">Ações</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {erro ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalColunas} className="py-8">
                  <div role="alert" className="flex flex-col items-center gap-3 text-center">
                    <p className="flex items-center gap-2 text-danger">
                      <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
                      {erro}
                    </p>
                    <BotaoTentarDeNovo />
                  </div>
                </TableCell>
              </TableRow>
            ) : linhas.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalColunas} className="p-0">{vazio ?? <p className="py-8 text-center text-muted">Nada para mostrar.</p>}</TableCell>
              </TableRow>
            ) : (
              linhas.map((l, i) => {
                const id = ids[i]!;
                return (
                  <LinhaTabela
                    key={id}
                    id={id}
                    href={hrefLinha?.(l)}
                    aoClicar={aoClicarLinha ? () => aoClicarLinha(l) : undefined}
                    ativa={linhaAtiva === id}
                  >
                    {selecionavel && <TableCell className="w-10"><CaixaSelecaoLinha id={id} rotulo={rotuloSelecao?.(l) ?? 'Selecionar linha'} /></TableCell>}
                    {colunas.map((c) => (
                      <TableCell key={c.id} className={cn(!c.quebrar && 'whitespace-nowrap', c.alinhar === 'direita' && 'text-right', c.className)}>{c.celula(l)}</TableCell>
                    ))}
                    {acoesLinha && <TableCell className="w-12 py-0 text-right">{acoesLinha(l)}</TableCell>}
                  </LinhaTabela>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {paginacao && !erro && paginacao.total > 0 && <Paginar paginacao={paginacao} params={params} />}
    </div>
  );

  return selecionavel ? <SelecaoTabela ids={ids} aoMudarSelecao={aoMudarSelecao}>{tabela}</SelecaoTabela> : tabela;
}

/** "Mostrando 51–100 de 132" e Anterior/Próxima como links (a página fica na URL). */
export function Paginar({ paginacao: p, params = {} }: { paginacao: Paginacao; params?: ParamsBusca }) {
  const classe = 'inline-flex h-8 items-center gap-1 rounded-md border border-input bg-surface px-3 text-sm text-foreground shadow-sm';
  const link = (pagina: number, rotulo: string, Icone: typeof ChevronLeft, depois = false) => {
    const conteudo = depois ? <>{rotulo}<Icone aria-hidden size={16} strokeWidth={1.75} /></> : <><Icone aria-hidden size={16} strokeWidth={1.75} />{rotulo}</>;
    const desativado = pagina < 1 || pagina > p.totalPaginas;
    if (desativado) return <span aria-disabled="true" className={cn(classe, 'cursor-not-allowed opacity-50')}>{conteudo}</span>;
    return <Link href={hrefComParams(params, { [PARAM_PAGINA]: pagina })} scroll={false} className={cn(classe, 'hover:bg-surface-muted')}>{conteudo}</Link>;
  };
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
      <p className="tabular">Mostrando {p.de}–{p.ate} de {p.total}</p>
      {p.totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          {link(p.pagina - 1, 'Anterior', ChevronLeft)}
          <span className="tabular">Página {p.pagina} de {p.totalPaginas}</span>
          {link(p.pagina + 1, 'Próxima', ChevronRight, true)}
        </div>
      )}
    </nav>
  );
}

/** Carregando (loading.tsx): esqueleto com o formato da tabela, nada de spinner no meio da página. */
export function DataTableCarregando({ colunas, linhas = 8, rotulo = 'Carregando' }: { colunas: readonly string[]; linhas?: number; rotulo?: string }) {
  return (
    <div role="status" aria-label={rotulo} className="overflow-hidden rounded-lg border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">{colunas.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: linhas }, (_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              {colunas.map((c, j) => <TableCell key={c}><Skeleton className={cn('h-4', j === 0 ? 'w-12' : j % 2 ? 'w-3/4' : 'w-1/2')} /></TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
