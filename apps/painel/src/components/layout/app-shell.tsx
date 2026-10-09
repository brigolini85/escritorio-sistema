'use client';

import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { EstadoAgente } from '@/components/patterns/agent-state-indicator';
import type { EscolhaTema } from '@/components/tema/tema';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import type { SituacaoSinal } from '@/lib/sinal-vida';
import { useAoVivo } from './ao-vivo';
import { AtalhosTeclado } from './atalhos-teclado';
import { AvisoDaUrl } from './aviso-da-url';
import { FaixaAmbiente, FaixaAmbienteDivergente } from './faixa-ambiente';
import { cookieDoMenu } from './preferencias';
import type { TamanhoLetra } from './tamanho-letra';
import { menuRecolhidoVisivel, telaComMenuRecolhido, telaRecolhida } from './menu-tela';
import { ProvedorMenuUsuario } from './menu-usuario';
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
  avisoAmbiente = null,
  tema,
  tamanhoLetra,
  whatsapp,
  recolhidoInicial,
}: {
  children: ReactNode;
  usuario: { nome: string; papel: 'admin' | 'atendente' };
  itens: ItemMenu[];
  contadores: Contadores;
  estadoAgente: EstadoAgente | null;
  ambiente: string | null;
  /** Auditoria 3.13: o AMBIENTE do painel é diferente do banco (só o administrador recebe). */
  avisoAmbiente?: string | null;
  tema: EscolhaTema;
  tamanhoLetra: TamanhoLetra;
  /** Situação do WhatsApp para o atalho do menu; null para quem não é administrador. */
  whatsapp: SituacaoSinal | null;
  recolhidoInicial: boolean;
}) {
  const [recolhido, setRecolhido] = useState(recolhidoInicial);
  const [gaveta, setGaveta] = useState(false);
  const caminho = usePathname();
  const [abertoNaTela, setAbertoNaTela] = useState(false);
  // Sair da tela (Atendimento ou Assistente) esquece o "aberto aqui": ao voltar, abre recolhido de novo (P17, D13).
  const tela = telaRecolhida(caminho);
  useEffect(() => { setAbertoNaTela(false); }, [tela]);
  const recolhidoVisivel = menuRecolhidoVisivel(caminho, recolhido, abertoNaTela);

  function alternar() {
    // Nas telas de menu recolhido, abrir ou recolher vale só nesta tela: a preferência guardada não muda.
    if (telaComMenuRecolhido(caminho)) {
      setAbertoNaTela(!abertoNaTela);
      return;
    }
    const novo = !recolhido;
    setRecolhido(novo);
    document.cookie = cookieDoMenu(novo);
  }

  const aoVivo = useAoVivo({ contadores, estadoAgente });

  // Altura do cabeçalho fixo em --altura-cabecalho: telas estilo caixa de entrada (Atendimento) usam
  // o utilitário altura-trabalho para ocupar exatamente o resto da tela.
  const cabecalho = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = cabecalho.current;
    if (!el) return;
    const publicar = () => document.documentElement.style.setProperty('--altura-cabecalho', `${el.offsetHeight}px`);
    publicar();
    const obs = new ResizeObserver(publicar);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <ProvedorMenuUsuario nome={usuario.nome} papel={usuario.papel} tema={tema} tamanhoLetra={tamanhoLetra}>
      <div className="flex min-h-screen">
        <a
          href="#conteudo"
          className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-base font-medium text-brand-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Pular para o conteúdo
        </a>
        <aside
          data-recolhido={recolhidoVisivel ? '' : undefined}
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150 ease-out print:hidden lg:block',
            recolhidoVisivel ? 'w-sidebar-recolhida' : 'w-sidebar',
          )}
        >
          <Sidebar itens={itens} contadores={aoVivo.contadores} whatsapp={whatsapp} recolhido={recolhidoVisivel} onAlternar={alternar} />
        </aside>

        <Sheet open={gaveta} onOpenChange={setGaveta}>
          {/* Gaveta também grafite; o X de fechar (último botão da gaveta) ganha a cor do texto do menu para não sumir. */}
          <SheetContent
            side="left"
            className="w-sidebar max-w-full gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button:last-child]:text-sidebar-foreground [&>button:last-child]:hover:bg-sidebar-raised"
          >
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Navegação do painel</SheetDescription>
            <Sidebar itens={itens} contadores={aoVivo.contadores} whatsapp={whatsapp} onNavegar={() => setGaveta(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header ref={cabecalho} className="sticky top-0 z-40 print:hidden">
            <FaixaAmbienteDivergente aviso={avisoAmbiente} />
            <FaixaAmbiente rotulo={ambiente} />
            <Topbar estadoAgente={aoVivo.estadoAgente} onAbrirMenu={() => setGaveta(true)} />
          </header>
          <main id="conteudo" tabIndex={-1} className="flex-1 p-6 focus-visible:outline-none">{children}</main>
        </div>
        <Toaster />
        <Suspense fallback={null}><AvisoDaUrl /></Suspense>
        <AtalhosTeclado />
      </div>
    </ProvedorMenuUsuario>
  );
}

