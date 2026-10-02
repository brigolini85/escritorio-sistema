'use client';

import { Menu } from 'lucide-react';
import { AgentStateIndicator, type EstadoAgente } from '@/components/patterns/agent-state-indicator';
import type { EscolhaTema } from '@/components/tema/tema';
import { BuscaGlobal } from './busca-global';
import { MenuUsuario } from './menu-usuario';
import type { TamanhoLetra } from './tamanho-letra';

/** Barra do topo: menu (só em telas menores), busca global, estado geral do agente e menu da pessoa. */
export function Topbar({
  usuario,
  tema,
  tamanhoLetra,
  estadoAgente,
  onAbrirMenu,
}: {
  usuario: { nome: string; papel: 'admin' | 'atendente' };
  tema: EscolhaTema;
  tamanhoLetra: TamanhoLetra;
  estadoAgente: EstadoAgente | null;
  onAbrirMenu: () => void;
}) {
  return (
    <div className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6">
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir menu"
        className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground lg:hidden"
      >
        <Menu aria-hidden size={20} strokeWidth={1.75} />
      </button>
      <div className="min-w-0 flex-1">
        <BuscaGlobal />
      </div>
      {estadoAgente && <AgentStateIndicator estado={estadoAgente} />}
      <MenuUsuario nome={usuario.nome} papel={usuario.papel} tema={tema} tamanhoLetra={tamanhoLetra} />
    </div>
  );
}
