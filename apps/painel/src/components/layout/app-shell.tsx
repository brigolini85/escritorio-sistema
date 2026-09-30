'use client';

import { useState, type ReactNode } from 'react';
import type { EstadoAgente } from '@/components/patterns/agent-state-indicator';
import type { EscolhaTema } from '@/components/tema/tema';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { useAoVivo } from './ao-vivo';
import { FaixaAmbiente } from './faixa-ambiente';
import { cookieDoMenu } from './preferencias';
import { Sidebar, type Contadores, type ItemMenu } from './sidebar';
import { Topbar } from './topbar';

/**
 * Casca do painel: menu lateral, barra do topo (com a faixa de ambiente), conteúdo e avisos.
 * Contadores do menu e estado do agente ficam ao vivo sem recarregar a página (ver ao-vivo.ts).
 */
export function AppShell({
  children,
  usuario,
  itens,
  contadores,
  estadoAgente,
  ambiente,
  tema,
  recolhidoInicial,
}: {
  children: ReactNode;
  usuario: { nome: string; papel: 'admin' | 'atendente' };
  itens: ItemMenu[];
  contadores: Contadores;
  estadoAgente: EstadoAgente | null;
  ambiente: string | null;
  tema: EscolhaTema;
  recolhidoInicial: boolean;
}) {
  const [recolhido, setRecolhido] = useState(recolhidoInicial);
  const [gaveta, setGaveta] = useState(false);

  function alternar() {
    const novo = !recolhido;
    setRecolhido(novo);
    document.cookie = cookieDoMenu(novo);
  }

  const aoVivo = useAoVivo({ contadores, estadoAgente });

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 border-r border-border bg-surface transition-[width] duration-150 ease-out lg:block',
          recolhido ? 'w-sidebar-recolhida' : 'w-sidebar',
        )}
      >
        <Sidebar itens={itens} contadores={aoVivo.contadores} recolhido={recolhido} onAlternar={alternar} />
      </aside>

      <Sheet open={gaveta} onOpenChange={setGaveta}>
        <SheetContent side="left" className="w-sidebar max-w-full gap-0 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação do painel</SheetDescription>
          <Sidebar itens={itens} contadores={aoVivo.contadores} onNavegar={() => setGaveta(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40">
          <FaixaAmbiente rotulo={ambiente} />
          <Topbar usuario={usuario} tema={tema} estadoAgente={aoVivo.estadoAgente} onAbrirMenu={() => setGaveta(true)} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}

