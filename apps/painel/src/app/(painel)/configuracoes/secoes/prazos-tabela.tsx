'use client';

import { Antes, useCampoDoFormulario } from '@/components/patterns/formulario-alteravel';
import { PrioridadeTexto } from '@/components/patterns/prioridade-prazo';
import { Input } from '@/components/ui/input';
import { COLUNA_PRAZO, diaCurto, textoDias, vencimentoCurto } from '@/lib/configuracoes';
import { ROTULO_PRIORIDADE, type Prioridade } from '@/lib/demandas';

export type LinhaPrazoDados = { prioridade: Prioridade; dias: number; abertas: number | null };

/** Uma prioridade: campo de dias (0 = mesmo dia, D16), exemplo de vencimento ao vivo e quantas abertas a usam. */
function LinhaPrazo({ l, exemplos }: { l: LinhaPrazoDados; exemplos: (string | null)[] }) {
  const col = COLUNA_PRAZO[l.prioridade];
  const valor = useCampoDoFormulario(col, String(l.dias));
  const n = /^\d{1,2}$/.test(valor) && Number(valor) <= 30 ? Number(valor) : null;
  const vence = n === null ? null : exemplos[n] ?? null;
  const era = n !== null && n !== l.dias ? exemplos[l.dias] ?? null : null;
  const nome = ROTULO_PRIORIDADE[l.prioridade];
  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="py-3 pr-4 text-left font-normal">
        <PrioridadeTexto prioridade={l.prioridade} caixaAlta />
      </th>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <Input
            name={col}
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            max="30"
            required
            defaultValue={l.dias}
            aria-label={`${nome} (dias úteis)`}
            aria-describedby={`${col}-vence`}
            className="tabular w-20"
          />
          <span className="whitespace-nowrap text-base text-muted">{n === null ? '' : n === 0 ? 'mesmo dia' : n === 1 ? 'dia útil' : 'dias úteis'}</span>
        </div>
        <Antes campo={col} texto={textoDias(l.dias)} />
      </td>
      <td id={`${col}-vence`} className="py-3 pr-4 text-base">
        {vence ? (
          <>
            vence <strong className="font-semibold text-foreground">{vencimentoCurto(vence)}</strong>
            {era && <span className="text-muted"> (era {diaCurto(era)})</span>}
          </>
        ) : (
          <span className="text-muted">{exemplos.length ? 'sem dia útil configurado' : '—'}</span>
        )}
      </td>
      <td className="tabular py-3 text-base text-muted">{l.abertas === null ? '—' : l.abertas === 1 ? '1 aberta' : `${l.abertas} abertas`}</td>
    </tr>
  );
}

/** Tabela da imagem A: Prioridade · Prazo · Exemplo · Usada em. */
export function TabelaPrazos({ linhas, exemplos, inicio }: { linhas: LinhaPrazoDados[]; exemplos: (string | null)[]; inicio: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-xl text-left">
        <thead>
          <tr className="text-xs font-extrabold uppercase tracking-wide text-muted">
            <th scope="col" className="pb-2 pr-4">Prioridade</th>
            <th scope="col" className="pb-2 pr-4">Prazo</th>
            <th scope="col" className="pb-2 pr-4">Exemplo: aberta hoje, {vencimentoCurto(inicio)}</th>
            <th scope="col" className="pb-2">Usada em</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => <LinhaPrazo key={l.prioridade} l={l} exemplos={exemplos} />)}
        </tbody>
      </table>
    </div>
  );
}
