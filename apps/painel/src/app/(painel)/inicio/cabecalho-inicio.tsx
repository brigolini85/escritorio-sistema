import type { ReactNode } from 'react';
import { AtualizadoHa } from './atualizado-ha';

/** Topo das duas versões: "atualizado há…", título (h1), linha de baixo e os botões da direita. */
export function CabecalhoInicio({ titulo, subtitulo, acoes, atualizadoEm }: {
  titulo: ReactNode; subtitulo: ReactNode; acoes?: ReactNode; atualizadoEm: string;
}) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex justify-end"><AtualizadoHa em={atualizadoEm} /></div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold text-foreground">{titulo}</h1>
          <p className="text-muted">{subtitulo}</p>
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </div>
    </header>
  );
}
