import type { ReactNode } from 'react';
import type { EstadoNovidade } from '@escritorio/core';
import type { NovidadeTela } from '@/lib/radar';
import { CartaoNovidade } from './cartao-novidade';

const VAZIA: Record<EstadoNovidade, string> = {
  para_decidir: 'Nada para decidir agora.', demanda: 'Nenhuma novidade virou demanda.', descartada: 'Nenhuma novidade descartada.',
};

/** Slots da Task 10: as janelas VER LISTA e MANDAR PARA CLIENTES AFETADOS de cada novidade. */
export type SlotsNovidade = { verLista?: (n: NovidadeTela) => ReactNode; mandar?: (n: NovidadeTela) => ReactNode };

/** A lista de novidades do estado escolhido. Com 100 ou mais, avisa que só mostra as mais novas. */
export function Novidades({ novidades, estado, total, nomes, agoraIso, dono, admin, slots }: {
  novidades: NovidadeTela[]; estado: EstadoNovidade; total: number; nomes: Record<string, string>; agoraIso: string; dono: boolean; admin: boolean; slots?: SlotsNovidade;
}) {
  if (novidades.length === 0) {
    return <p data-testid="novidades-vazia" className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted">{VAZIA[estado]}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {total >= 100 && <p className="text-xs text-muted">Mostrando as 100 mais novas.</p>}
      <ul className="flex flex-col gap-3">
        {novidades.map((n) => (
          <li key={n.id}>
            <CartaoNovidade n={n} quem={n.decididaPor ? nomes[n.decididaPor] ?? null : null} agoraIso={agoraIso} dono={dono} admin={admin}
              verLista={slots?.verLista?.(n)} mandar={slots?.mandar?.(n)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
