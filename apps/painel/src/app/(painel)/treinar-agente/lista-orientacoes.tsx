import { Building2, FilterX, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/patterns/empty-state';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { ROTULO_TIPO, TIPOS, type Medidor, type TipoOrientacao } from '@/lib/orientacoes';
import { ChaveOrientacao } from './chave-orientacao';
import type { ValePara } from './esquemas';
import { MedidorCompacto } from './medidor-compacto';
import { camposAPreencher, FAIXA_TIPO, ROTULO_CURTO_TIPO } from './tela';

export type ItemLista = {
  id: string;
  titulo: string;
  texto: string;
  tipo: TipoOrientacao;
  ativo: boolean;
  ensinada: boolean;
  clienteId: string | null;
  setorId: string | null;
  empresa: { nome: string; ativa: boolean } | null;
  setor: { nome: string; ativo: boolean } | null;
};

type Filtro = 'ligadas' | 'desligadas' | null;

/** O que fica embaixo do título: o que falta preencher (D17), a empresa, o setor ou "Todos os clientes". */
function Detalhe({ l }: { l: ItemLista }) {
  const faltam = camposAPreencher(l.texto);
  if (faltam > 0) return <span className="truncate font-semibold text-warning">{faltam === 1 ? '1 campo a preencher' : `${faltam} campos a preencher`}</span>;
  if (l.clienteId) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <Building2 aria-hidden size={14} strokeWidth={1.75} className="shrink-0" />
        <span className="truncate">{l.empresa?.nome ?? 'Empresa removida'}</span>
        {l.empresa && !l.empresa.ativa && <Badge variant="outline">arquivada</Badge>}
      </span>
    );
  }
  if (l.setorId) return <span className="truncate">Setor {l.setor?.nome ?? 'removido'}{l.setor && !l.setor.ativo ? ' (inativo)' : ''}</span>;
  return <span className="truncate">Todos os clientes</span>;
}

/**
 * Coluna da lista (spec 7C.5, imagem B): "Treinar N" + NOVA, medidor compacto, busca, Todas · Ligadas · Desligadas,
 * legenda das cores e uma linha por orientação (faixa do tipo, título, detalhe, "do Atendimento" e a chave).
 * A chave fica fora do link (dois controles não se aninham).
 */
export function ListaOrientacoes({
  linhas, total, contagem, filtro, tipo = null, vale = null, busca, aberta, orientacaoNaUrl, medidor, empresaMaisPesada, erro, aviso, hrefOrientacao, hrefFiltro, hrefNova,
}: {
  linhas: ItemLista[];
  total: number;
  contagem: { todas: number; ligadas: number; desligadas: number };
  filtro: Filtro;
  /** ?tipo= e ?vale= da URL (D16: sem botão, mas a busca mantém). */
  tipo?: TipoOrientacao | null;
  vale?: ValePara | null;
  busca: string;
  aberta: string | null;
  /** O valor de ?orientacao= (inclusive "nova"), mantido pela busca. */
  orientacaoNaUrl: string | null;
  medidor: Medidor;
  empresaMaisPesada: string | null;
  erro: string | null;
  aviso: string | null;
  hrefOrientacao: (id: string) => string;
  hrefFiltro: (filtro: Filtro) => string;
  hrefNova: string;
}) {
  const filtros: { valor: Filtro; rotulo: string; n: number | null; chave: string }[] = [
    { valor: null, rotulo: 'Todas', n: null, chave: 'todas' },
    { valor: 'ligadas', rotulo: 'Ligadas', n: contagem.ligadas, chave: 'ligadas' },
    { valor: 'desligadas', rotulo: 'Desligadas', n: contagem.desligadas, chave: 'desligadas' },
  ];
  return (
    <section aria-label="Orientações" className="flex min-h-0 flex-col border-border bg-surface max-lg:border-b lg:w-lista-treinar lg:shrink-0 lg:border-r">
      <div className="flex flex-col gap-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-foreground">
            Treinar<span className="sr-only"> o agente</span> <span className="tabular font-light text-brand">{total}</span>
          </h1>
          <Link href={hrefNova} scroll={false} aria-label="Nova orientação" className={variantesBotao({ size: 'sm' })}>
            <Plus aria-hidden size={16} strokeWidth={1.75} />
            Nova
          </Link>
        </div>
        <MedidorCompacto medidor={medidor} empresa={empresaMaisPesada} />
        {aviso && <p className="text-sm text-warning">{aviso}</p>}
        <form role="search" action="/treinar-agente" className="relative">
          {orientacaoNaUrl && <input type="hidden" name="orientacao" value={orientacaoNaUrl} />}
          {filtro && <input type="hidden" name="ativo" value={filtro} />}
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          {vale && <input type="hidden" name="vale" value={vale} />}
          <Search aria-hidden size={16} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input type="search" name="q" defaultValue={busca} aria-label="Buscar orientação" placeholder="Buscar orientação" className="pl-9" />
        </form>
        <nav aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
          {filtros.map((x) => (
            <Link
              key={x.chave}
              href={hrefFiltro(x.valor)}
              scroll={false}
              aria-current={filtro === x.valor ? 'page' : undefined}
              data-filtro={x.chave}
              data-contagem={x.n ?? contagem.todas}
              className={cn(
                'rounded-md border px-3 py-1 text-sm font-semibold transition-colors duration-150 ease-out',
                filtro === x.valor ? 'border-grafite bg-grafite text-grafite-foreground' : 'border-border bg-surface text-foreground hover:bg-surface-muted',
              )}
            >
              {x.rotulo}{x.n !== null && <> <span className="tabular">{x.n}</span></>}
            </Link>
          ))}
        </nav>
        <p className="flex flex-wrap gap-3 text-xs text-muted">
          {TIPOS.map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span aria-hidden className={cn('size-2 rounded-full', FAIXA_TIPO[t])} />
              {ROTULO_CURTO_TIPO[t]}
            </span>
          ))}
        </p>
      </div>
      {erro ? (
        <p role="alert" className="p-4 text-sm text-danger">{erro}</p>
      ) : total === 0 ? (
        <p className="p-4 text-sm text-muted">A lista está vazia: comece por um exemplo ao lado.</p>
      ) : linhas.length === 0 ? (
        <EmptyState
          icone={FilterX}
          titulo="Nenhuma orientação neste filtro."
          descricao="Tente outro filtro ou limpe a busca."
          acao={<Link href="/treinar-agente" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Limpar filtros</Link>}
        />
      ) : (
        <ul aria-label="Orientações do agente" className="min-h-0 flex-1 overflow-y-auto">
          {linhas.map((l) => (
            <li
              key={l.id}
              data-orientacao={l.id}
              className={cn('relative flex items-center gap-3 border-b border-border py-3 pr-3 pl-5', aberta === l.id && 'bg-brand-soft')}
            >
              <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', FAIXA_TIPO[l.tipo])} />
              <Link href={hrefOrientacao(l.id)} scroll={false} aria-current={aberta === l.id ? 'true' : undefined} className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm">
                <span className="truncate font-semibold text-foreground">{l.titulo}</span>
                <span className="flex min-w-0 items-center gap-1 text-sm text-muted">
                  <Detalhe l={l} />
                  {l.ensinada && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="shrink-0 font-semibold text-info">do Atendimento</span>
                    </>
                  )}
                </span>
                <span className="sr-only">{ROTULO_TIPO[l.tipo]}</span>
              </Link>
              <ChaveOrientacao id={l.id} titulo={l.titulo} ligada={l.ativo} mostrarTexto={false} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
