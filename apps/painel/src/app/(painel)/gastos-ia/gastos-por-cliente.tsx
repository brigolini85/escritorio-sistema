import Link from 'next/link';
import { Bot, Building2, ChevronDown, ChevronUp, ExternalLink, Search, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { cn } from '@/lib/cn';
import { formatarData, formatarDataHora, formatarNumero, formatarUSD } from '@/lib/formatos';
import { percentual } from '@/lib/gastos';
import { hrefComParams, type ParamsBusca } from '@/lib/tabela-url';

export type LinhaCliente = { cliente_id: string | null; nome: string; atendimentos: number | string; custo_usd: number | string; resolvidos: number | string };
export type LinhaAtendimento = {
  conversa_id: string | null; dia: string; inicio: string | null; contato: string; mensagens: number | string; resultado: string; custo_usd: number | string;
};

const chave = (clienteId: string | null) => clienteId ?? 'sem';

/** Selo do resultado: ícone e texto, nunca só a cor. */
function Resultado({ valor }: { valor: string }) {
  const passou = valor === 'passou_para_pessoa';
  const Icone = passou ? UserRound : Bot;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold text-foreground', passou ? 'bg-warning-soft' : 'bg-success-soft')}>
      <Icone aria-hidden size={14} strokeWidth={1.75} />
      {passou ? 'passou para pessoa' : 'resolvido pelo agente'}
    </span>
  );
}

function Atendimentos({ id, empresa, linhas }: { id: string; empresa: string; linhas: LinhaAtendimento[] }) {
  if (linhas.length === 0) return <p id={id} className="px-3 py-4 text-sm text-muted">Nenhum atendimento desta empresa neste período.</p>;
  return (
    <table id={id} aria-label={`Atendimentos de ${empresa}`} className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left font-bold uppercase tracking-wide text-muted">
          <th scope="col" className="py-2 pl-3 pr-3">Data</th>
          <th scope="col" className="py-2 pr-3">Contato</th>
          <th scope="col" className="py-2 pr-3 text-right">Mensagens</th>
          <th scope="col" className="py-2 pr-3">Resultado</th>
          <th scope="col" className="py-2 pr-3 text-right">Custo</th>
          <th scope="col" className="py-2 pr-3"><span className="sr-only">Abrir a conversa</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {linhas.map((a, n) => {
          const quando = a.inicio ? formatarDataHora(a.inicio) : formatarData(`${a.dia}T12:00:00-03:00`);
          return (
            <tr key={`${a.conversa_id ?? 'apagada'}-${a.dia}-${n}`}>
              <td className="tabular whitespace-nowrap py-2 pl-3 pr-3 text-foreground">{quando}</td>
              <td className="py-2 pr-3 text-foreground">{a.contato}</td>
              <td className="tabular py-2 pr-3 text-right text-muted">{formatarNumero(Number(a.mensagens) || 0, 0)}</td>
              <td className="py-2 pr-3"><Resultado valor={a.resultado} /></td>
              <td className={cn('tabular whitespace-nowrap py-2 pr-3 text-right', n === 0 && 'font-extrabold')}>{formatarUSD(Number(a.custo_usd) || 0)}</td>
              <td className="whitespace-nowrap py-2 pr-3">
                {a.conversa_id ? (
                  <Link href={`/atendimento/${a.conversa_id}?data=${a.dia}`} className="inline-flex items-center gap-1 font-bold text-brand underline-offset-4 hover:underline">
                    abrir<span className="sr-only"> a conversa de {a.contato} em {quando}</span>
                    <ExternalLink aria-hidden size={14} strokeWidth={1.75} />
                  </Link>
                ) : (
                  <span className="text-muted">conversa apagada</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Gastos por cliente (spec 7B.3, P5/P10): busca, ordenado por custo; abrir a empresa lista os atendimentos com "abrir". */
export function GastosPorCliente({ linhas, params, busca, aberta, atendimentos }: {
  linhas: LinhaCliente[];
  params: ParamsBusca;
  busca: string;
  /** `?empresa=` já validado: uuid ou 'sem'. */
  aberta: string | null;
  atendimentos: LinhaAtendimento[];
}) {
  // A busca e o período seguem juntos; a empresa aberta e a pessoa saem ao buscar.
  const ocultos = (['p', 'de', 'ate'] as const).flatMap((k) => {
    const v = params[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s ? [[k, s] as const] : [];
  });

  return (
    <section aria-labelledby="gastos-clientes-titulo" className="flex flex-col rounded-lg border border-border bg-surface p-4 text-foreground">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="gastos-clientes-titulo" className="text-sm font-bold uppercase tracking-wide text-brand">Gastos por cliente</h2>
        <form method="get" action="/gastos-ia" role="search" className="flex items-center gap-2 text-sm text-subtle">
          {ocultos.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2 focus-within:ring-2 focus-within:ring-ring">
            <Search aria-hidden size={14} strokeWidth={1.75} />
            <input type="search" name="busca" aria-label="Buscar empresa" placeholder="buscar empresa" defaultValue={busca} maxLength={100} className="w-40 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle" />
          </label>
          <span>· ordenado por custo</span>
        </form>
      </div>
      {linhas.length === 0 ? (
        <EmptyState icone={Building2} titulo={busca ? `Nenhuma empresa com gasto encontrada para “${busca}”.` : 'Nenhum atendimento com gasto de IA neste período.'} className="py-6" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-border text-left text-sm font-bold uppercase tracking-wide text-muted">
                <th scope="col" className="w-8 py-2 pl-3 pr-3">#</th>
                <th scope="col" className="py-2 pr-3">Empresa</th>
                <th scope="col" className="py-2 pr-3 text-right">Atendimentos</th>
                <th scope="col" className="py-2 pr-3 text-right">Custo</th>
                <th scope="col" className="py-2 pr-3 text-right">Por atendimento</th>
                <th scope="col" className="py-2 pr-3 text-right">Resolvidos pelo agente</th>
              </tr>
            </thead>
            {linhas.map((c, n) => {
              const id = chave(c.cliente_id);
              const estaAberta = aberta === id;
              const qtd = Number(c.atendimentos) || 0;
              const custo = Number(c.custo_usd) || 0;
              const painel = `gastos-atendimentos-${id}`;
              const Chevron = estaAberta ? ChevronUp : ChevronDown;
              return (
                <tbody key={id} className="border-b border-border">
                  <tr className={cn(estaAberta && 'bg-surface-muted')}>
                    <td className={cn('tabular border-l-4 py-3 pl-2 pr-3 text-muted', estaAberta ? 'border-brand' : 'border-transparent')}>{n + 1}</td>
                    <td className="py-3 pr-3">
                      <Link
                        role="button"
                        aria-expanded={estaAberta}
                        aria-controls={painel}
                        href={`/gastos-ia${hrefComParams(params, { empresa: estaAberta ? null : id })}`}
                        scroll={false}
                        className="inline-flex items-center gap-2 font-semibold text-foreground underline-offset-4 hover:text-brand hover:underline"
                      >
                        {c.nome}
                        <Chevron aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
                      </Link>
                    </td>
                    <td className="tabular py-3 pr-3 text-right text-foreground">{formatarNumero(qtd, 0)}</td>
                    <td className={cn('tabular whitespace-nowrap py-3 pr-3 text-right', n === 0 ? 'font-extrabold' : 'text-foreground')}>{formatarUSD(custo)}</td>
                    <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-foreground">{qtd > 0 ? formatarUSD(custo / qtd) : '—'}</td>
                    <td className="tabular py-3 pr-3 text-right text-foreground">{percentual(Number(c.resolvidos) || 0, qtd)}%</td>
                  </tr>
                  {estaAberta && (
                    <tr>
                      <td colSpan={6} className="border-l-4 border-brand bg-surface-muted p-0 pb-2">
                        <Atendimentos id={painel} empresa={c.nome} linhas={atendimentos} />
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </section>
  );
}
