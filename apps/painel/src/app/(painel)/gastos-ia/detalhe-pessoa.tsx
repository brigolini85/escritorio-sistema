import { Download, ReceiptText } from 'lucide-react';
import type { FuncionalidadeIa } from '@escritorio/core';
import { EmptyState } from '@/components/patterns/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatarDataHora } from '@/lib/formatos';
import { INFO_FUNCIONALIDADE, formatarUsdFino, type Periodo } from '@/lib/gastos';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { IconeFuncionalidade } from './icone-funcionalidade';

/** Quantas chamadas o painel mostra (as mais recentes); o resto sai no Exportar. */
export const LIMITE_CHAMADAS_PESSOA = 200;

/** Detalhe linha a linha de uma pessoa (P16): as últimas 200 chamadas do período, com o link de exportar só dela. */
export async function DetalhePessoa({ pessoa, periodo, hrefExportar }: { pessoa: string; periodo: Periodo; hrefExportar: string }) {
  const sb = await supabaseServidor();
  const [{ data: usuario }, chamadas] = await Promise.all([
    sb.from('usuarios').select('nome').eq('id', pessoa).maybeSingle(),
    sb.rpc('gastos_chamadas', { p_de: periodo.de, p_ate: periodo.ate, p_usuario: pessoa, p_limite: LIMITE_CHAMADAS_PESSOA }),
  ]);
  if (chamadas.error) throw new Error(chamadas.error.message);
  const linhas = chamadas.data ?? [];
  const nome = usuario?.nome ?? 'Pessoa não encontrada';

  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-extrabold">{nome}</SheetTitle>
        <SheetDescription className="text-sm">Chamadas à IA · {periodo.rotulo}</SheetDescription>
      </SheetHeader>
      <SheetBody className="py-4">
        {linhas.length === 0 ? (
          <EmptyState icone={ReceiptText} titulo="Nenhuma chamada à IA desta pessoa neste período." className="py-6" />
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Chamadas à IA de {nome}</caption>
            <thead>
              <tr className="border-b border-border text-left font-bold uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-3">Data e hora</th>
                <th scope="col" className="py-2 pr-3">Funcionalidade</th>
                <th scope="col" className="py-2 pr-3">Empresa</th>
                <th scope="col" className="py-2 pr-3">Modelo</th>
                <th scope="col" className="py-2 text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map((c) => {
                const info = INFO_FUNCIONALIDADE[c.funcionalidade as FuncionalidadeIa] ?? INFO_FUNCIONALIDADE.nao_identificado;
                return (
                  <tr key={c.id}>
                    <td className="tabular whitespace-nowrap py-2 pr-3 text-muted">{formatarDataHora(c.criado_em)}</td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        <IconeFuncionalidade icone={info.icone} />
                        {info.rotulo}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-foreground">{c.empresa ?? '—'}</td>
                    <td className="py-2 pr-3 text-muted">{c.modelo}</td>
                    <td className="tabular whitespace-nowrap py-2 text-right">{formatarUsdFino(Number(c.custo_usd) || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SheetBody>
      <SheetFooter className="items-center justify-between">
        <span className="text-sm text-subtle">
          {linhas.length === LIMITE_CHAMADAS_PESSOA ? `Mostrando as ${LIMITE_CHAMADAS_PESSOA} chamadas mais recentes do período` : null}
        </span>
        {/* Download pela rota de exportar (Task 10): link simples, sem navegação do Next. */}
        <a href={hrefExportar} download className="inline-flex items-center gap-1.5 text-sm font-bold text-brand underline-offset-4 hover:underline">
          <Download aria-hidden size={14} strokeWidth={1.75} />
          Exportar só desta pessoa
        </a>
      </SheetFooter>
    </>
  );
}

export function EsqueletoPessoa() {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="sr-only">Carregando as chamadas da pessoa</SheetTitle>
        <SheetDescription className="sr-only">As chamadas aparecem em instantes.</SheetDescription>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-32" />
      </SheetHeader>
      <SheetBody role="status" aria-label="Carregando as chamadas da pessoa" className="flex flex-col gap-3 py-4">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </SheetBody>
    </>
  );
}
