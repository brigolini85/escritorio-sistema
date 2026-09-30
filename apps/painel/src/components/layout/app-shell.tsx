'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { EstadoAgente } from '@/components/patterns/agent-state-indicator';
import type { EscolhaTema } from '@/components/tema/tema';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Toaster, toast } from '@/components/ui/toaster';
import { autenticarTempoReal, supabaseNavegador } from '@/lib/supabase/navegador';
import { cn } from '@/lib/cn';
import { FaixaAmbiente } from './faixa-ambiente';
import { cookieDoMenu } from './preferencias';
import { Sidebar, type Contadores, type ItemMenu } from './sidebar';
import { Topbar } from './topbar';

/**
 * Casca do painel: menu lateral, barra do topo (com a faixa de ambiente), conteúdo e avisos.
 * Também mantém os contadores do menu ao vivo: mudança em conversas ou demandas visíveis recarrega os dados
 * do servidor (router.refresh, mesmo padrão de AtualizarAoVivo).
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

  useContadoresAoVivo(contadores);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 border-r border-border bg-surface transition-[width] duration-150 ease-out lg:block',
          recolhido ? 'w-sidebar-recolhida' : 'w-sidebar',
        )}
      >
        <Sidebar itens={itens} contadores={contadores} recolhido={recolhido} onAlternar={alternar} />
      </aside>

      <Sheet open={gaveta} onOpenChange={setGaveta}>
        <SheetContent side="left" className="w-sidebar max-w-full gap-0 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação do painel</SheetDescription>
          <Sidebar itens={itens} contadores={contadores} onNavegar={() => setGaveta(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40">
          <FaixaAmbiente rotulo={ambiente} />
          <Topbar usuario={usuario} tema={tema} estadoAgente={estadoAgente} onAbrirMenu={() => setGaveta(true)} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}

/**
 * Recarrega a página (e, com ela, os contadores do layout) quando conversas ou demandas visíveis mudam.
 * Espera um pouco para juntar rajadas de eventos. Na lista do Atendimento a página já faz isso sozinha.
 * Quando aumentam as conversas aguardando atendimento, avisa com um toast.
 */
function useContadoresAoVivo(contadores: Contadores) {
  const router = useRouter();
  const pathname = usePathname();
  const caminho = useRef(pathname);
  useEffect(() => {
    caminho.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const sb = supabaseNavegador();
    let espera: ReturnType<typeof setTimeout> | undefined;
    const atualizar = () => {
      if (caminho.current === '/atendimento') return;
      clearTimeout(espera);
      espera = setTimeout(() => router.refresh(), 400);
    };
    let ativo = true;
    let canal: ReturnType<typeof sb.channel> | undefined;
    void autenticarTempoReal(sb).catch(() => undefined).then(() => {
      if (!ativo) return;
      canal = sb.channel('painel-casca')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas' }, atualizar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados' }, atualizar)
        .subscribe();
    });
    return () => {
      ativo = false;
      clearTimeout(espera);
      if (canal) void sb.removeChannel(canal);
    };
  }, [router]);

  const anterior = useRef(contadores.atendimento);
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = contadores.atendimento;
    if (antes !== null && contadores.atendimento !== null && contadores.atendimento > antes) {
      toast('Nova conversa aguardando atendimento', {
        action: { label: 'Abrir', onClick: () => router.push('/atendimento?filtro=sem_responsavel') },
      });
    }
  }, [contadores.atendimento, router]);
}
