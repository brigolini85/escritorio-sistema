'use client';

import {
  Building2, ChevronDown, ChevronRight, ClipboardCheck, Contact, GraduationCap, LayoutGrid, MessageCircle, PanelLeftClose, PanelLeftOpen,
  Settings, Sparkles, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useState, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { descricaoContador, rotuloContador } from '@/lib/contadores';
import { MONOGRAMA, NOME_ESCRITORIO } from '@/lib/escritorio';
import type { SituacaoSinal } from '@/lib/sinal-vida';
import { AtalhosMenu } from './atalhos-menu';

// O tipo vive em lib/menu.ts (agora com filhos); reexportado para quem importa daqui.
import type { ItemMenu } from '@/lib/menu';
export type { ItemMenu };
export type Contadores = { atendimento: number | null; demandas: number | null };

// Ícone e cor de módulo por href: os itens (e quem vê cada um) continuam vindo de itensDoMenu (lib/menu.ts).
const ICONES: Record<string, LucideIcon> = {
  '/inicio': LayoutGrid,
  '/atendimento': MessageCircle,
  '/demandas': ClipboardCheck,
  '/clientes': Building2,
  '/contatos': Contact,
  '/assistente': Sparkles,
  '/treinar-agente': GraduationCap,
  '/configuracoes': Settings,
};
const COR_MODULO: Record<string, string> = {
  '/inicio': 'text-modulo-inicio',
  '/atendimento': 'text-modulo-atendimento',
  '/demandas': 'text-modulo-demandas',
  '/clientes': 'text-modulo-clientes',
  '/contatos': 'text-modulo-contatos',
  '/assistente': 'text-modulo-assistente',
  '/treinar-agente': 'text-modulo-treinar',
  '/configuracoes': 'text-modulo-configuracoes',
};

// Foco em champanhe: o anel padrão (vinho) some sobre o grafite; para dentro, para a rolagem não cortar.
const FOCO = 'focus-visible:outline-champagne focus-visible:-outline-offset-2';

function casa(pathname: string, href: string): boolean {
  const caminho = href.split('#')[0]!;
  return pathname === caminho || pathname.startsWith(`${caminho}/`);
}

// O pai fica ativo também nas telas dos filhos (Configurações vale para /usuarios).
function ativo(pathname: string, item: ItemMenu): boolean {
  return casa(pathname, item.href) || (item.filhos ?? []).some((f) => casa(pathname, f.href));
}

function contadorDo(href: string, c: Contadores): { tipo: 'atendimento' | 'demandas'; n: number } | null {
  if (href === '/atendimento' && c.atendimento) return { tipo: 'atendimento', n: c.atendimento };
  if (href === '/demandas' && c.demandas) return { tipo: 'demandas', n: c.demandas };
  return null;
}

function classeItem(atual: boolean, recolhido: boolean): string {
  return cn(
    'relative flex h-12 w-full items-center gap-3 text-lg transition-colors duration-150 ease-out',
    FOCO,
    recolhido ? 'justify-center px-0' : 'px-5',
    atual
      ? 'bg-sidebar-active font-medium text-sidebar-active-foreground before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-champagne'
      : 'text-sidebar-foreground hover:bg-sidebar-raised',
  );
}

function IconeItem({ href, atual }: { href: string; atual: boolean }) {
  const Icone = ICONES[href] ?? LayoutGrid;
  return <Icone aria-hidden size={18} strokeWidth={1.75} className={cn('shrink-0', atual ? 'text-sidebar-active-foreground' : COR_MODULO[href])} />;
}

function ComDica({ recolhido, dica, children }: { recolhido: boolean; dica: string; children: ReactNode }) {
  if (!recolhido) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{dica}</TooltipContent>
    </Tooltip>
  );
}

/** Configurações com submenu: menu suspenso à direita no menu fixo; na gaveta, abre os filhos logo abaixo. */
function ItemComFilhos({
  item,
  atual,
  recolhido,
  onNavegar,
}: {
  item: ItemMenu;
  atual: boolean;
  recolhido: boolean;
  onNavegar?: () => void;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(atual);
  const filhos: ItemMenu[] = [{ rotulo: 'Todas as configurações', href: item.href }, ...(item.filhos ?? [])];
  const idLista = 'submenu-configuracoes-gaveta';

  if (onNavegar) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-controls={idLista}
          className={cn(classeItem(atual, false), 'cursor-pointer')}
        >
          <IconeItem href={item.href} atual={atual} />
          <span className="flex-1 truncate text-left">{item.rotulo}</span>
          <ChevronDown aria-hidden size={16} strokeWidth={1.75} className={cn('shrink-0 transition-transform duration-150', aberto && 'rotate-180')} />
        </button>
        {/* Fica no DOM (hidden quando fechado) para o aria-controls sempre apontar para algo que existe. */}
        <ul id={idLista} hidden={!aberto}>
          {filhos.map((f) => {
            // Só a rota exata conta: os filhos com âncora (#setores…) são trechos da mesma tela.
            const aqui = !f.href.includes('#') && pathname === f.href;
            return (
              <li key={f.href} className="border-t border-sidebar-border">
                <Link
                  href={f.href}
                  onClick={onNavegar}
                  aria-current={aqui ? 'page' : undefined}
                  className={cn(
                    'flex h-11 items-center pl-12 pr-5 text-base text-sidebar-foreground transition-colors duration-150 ease-out hover:bg-sidebar-raised',
                    FOCO,
                    aqui && 'font-medium',
                  )}
                >
                  {f.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <ComDica recolhido={recolhido} dica={item.rotulo}>
        <DropdownMenuTrigger
          aria-label={`${item.rotulo}: abrir submenu`}
          aria-current={atual ? 'page' : undefined}
          className={cn(classeItem(atual, recolhido), 'cursor-pointer')}
        >
          <IconeItem href={item.href} atual={atual} />
          <span className={cn('flex-1 truncate text-left', recolhido && 'sr-only')}>{item.rotulo}</span>
          {!recolhido && <ChevronRight aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />}
        </DropdownMenuTrigger>
      </ComDica>
      <DropdownMenuContent side="right" align="start" className="w-60 border-sidebar-border bg-sidebar-raised text-sidebar-foreground">
        {filhos.map((f, i) => (
          <Fragment key={f.href}>
            <DropdownMenuItem asChild className="cursor-pointer data-highlighted:bg-sidebar-border">
              <Link href={f.href}>{f.rotulo}</Link>
            </DropdownMenuItem>
            {i === 0 && <DropdownMenuSeparator className="bg-sidebar-border" />}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Navegação principal: fixa à esquerda (recolhível) ou dentro da gaveta em telas menores. Fundo grafite. */
export function Sidebar({
  itens,
  contadores,
  whatsapp,
  recolhido = false,
  onAlternar,
  onNavegar,
}: {
  itens: ItemMenu[];
  contadores: Contadores;
  /** Situação do WhatsApp para o atalho; null para quem não é administrador. */
  whatsapp: SituacaoSinal | null;
  recolhido?: boolean;
  /** Botão de recolher/expandir (só na versão fixa). */
  onAlternar?: () => void;
  /** Chamado ao clicar num item (a gaveta fecha). */
  onNavegar?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex shrink-0 flex-col items-center border-b border-sidebar-border', recolhido ? 'gap-3 px-2 py-4' : 'gap-4 px-4 pb-5 pt-6')}>
        <span
          aria-hidden
          title={NOME_ESCRITORIO}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full bg-sidebar-active font-extrabold text-sidebar-active-foreground ring-champagne',
            recolhido ? 'size-10 text-base ring-2' : 'size-20 text-2xl ring-4',
          )}
        >
          {MONOGRAMA}
        </span>
        <span className="sr-only">{NOME_ESCRITORIO}</span>
        <AtalhosMenu recolhido={recolhido} whatsapp={whatsapp} />
      </div>

      <nav aria-label="Menu principal" className="flex-1 overflow-y-auto">
        <ul>
          {itens.map((item) => {
            const atual = ativo(pathname, item);
            if (item.filhos?.length) {
              return (
                <li key={item.href} className="border-b border-sidebar-border">
                  <ItemComFilhos item={item} atual={atual} recolhido={recolhido} onNavegar={onNavegar} />
                </li>
              );
            }
            const contador = contadorDo(item.href, contadores);
            const idDescricao = contador ? `menu-contador-${contador.tipo}${onNavegar ? '-gaveta' : ''}` : undefined;
            const rotuloSelo = rotuloContador(contador?.n);
            const dica = `${item.rotulo}${contador ? ` · ${descricaoContador(contador.tipo, contador.n)}` : ''}`;
            return (
              <li key={item.href} className="border-b border-sidebar-border">
                <ComDica recolhido={recolhido} dica={dica}>
                  <Link
                    href={item.href}
                    onClick={onNavegar}
                    aria-current={atual ? 'page' : undefined}
                    aria-describedby={idDescricao}
                    className={classeItem(atual, recolhido)}
                  >
                    <IconeItem href={item.href} atual={atual} />
                    <span className={cn('flex-1 truncate', recolhido && 'sr-only')}>{item.rotulo}</span>
                    {contador && rotuloSelo && recolhido && (
                      // Recolhido: só um ponto no canto do ícone; o número fica na dica e na descrição acessível.
                      <span
                        aria-hidden
                        className={cn(
                          'absolute right-5 top-3 size-2 rounded-full ring-2 ring-sidebar',
                          contador.tipo === 'atendimento' ? 'bg-danger' : 'bg-sidebar-foreground',
                        )}
                      />
                    )}
                    {contador && rotuloSelo && !recolhido && (
                      <span
                        aria-hidden
                        className={cn(
                          'tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold',
                          contador.tipo === 'atendimento' ? 'bg-danger text-danger-foreground' : 'bg-sidebar-raised text-sidebar-foreground',
                        )}
                      >
                        {rotuloSelo}
                      </span>
                    )}
                    {contador && <span id={idDescricao} hidden>{descricaoContador(contador.tipo, contador.n)}</span>}
                  </Link>
                </ComDica>
              </li>
            );
          })}
        </ul>
      </nav>

      {onAlternar && (
        <button
          type="button"
          onClick={onAlternar}
          aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!recolhido}
          className={cn(
            'flex h-11 w-full shrink-0 cursor-pointer items-center gap-2 border-t border-sidebar-border px-5 text-sm text-sidebar-foreground/80 transition-colors duration-150 ease-out hover:text-sidebar-foreground',
            FOCO,
            recolhido && 'justify-center px-0',
          )}
        >
          {recolhido ? <PanelLeftOpen aria-hidden size={16} strokeWidth={1.75} /> : <PanelLeftClose aria-hidden size={16} strokeWidth={1.75} />}
          <span className={cn(recolhido && 'sr-only')}>Recolher</span>
        </button>
      )}
    </div>
  );
}
