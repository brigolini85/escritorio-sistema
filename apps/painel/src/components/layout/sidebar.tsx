'use client';

import {
  Building2, ClipboardList, Contact, House, MessagesSquare, PanelLeftClose, PanelLeftOpen, Settings, Sparkles, UserCog,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { descricaoContador, rotuloContador } from '@/lib/contadores';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type ItemMenu = { rotulo: string; href: string };
export type Contadores = { atendimento: number | null; demandas: number | null };

// Ícone e grupo por href: os itens (e quem vê cada um) continuam vindo de itensDoMenu (lib/menu.ts).
const ICONES: Record<string, LucideIcon> = {
  '/inicio': House,
  '/atendimento': MessagesSquare,
  '/demandas': ClipboardList,
  '/clientes': Building2,
  '/contatos': Contact,
  '/assistente': Sparkles,
  '/usuarios': UserCog,
  '/configuracoes': Settings,
};
const ADMINISTRACAO = new Set(['/usuarios', '/configuracoes']);

function ativo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function contadorDo(href: string, c: Contadores): { tipo: 'atendimento' | 'demandas'; n: number } | null {
  if (href === '/atendimento' && c.atendimento) return { tipo: 'atendimento', n: c.atendimento };
  if (href === '/demandas' && c.demandas) return { tipo: 'demandas', n: c.demandas };
  return null;
}

/** Navegação principal: fixa à esquerda (240px, recolhível para 64px) ou dentro da gaveta em telas menores. */
export function Sidebar({
  itens,
  contadores,
  recolhido = false,
  onAlternar,
  onNavegar,
}: {
  itens: ItemMenu[];
  contadores: Contadores;
  recolhido?: boolean;
  /** Botão de recolher/expandir (só na versão fixa). */
  onAlternar?: () => void;
  /** Chamado ao clicar num item (a gaveta fecha). */
  onNavegar?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 shrink-0 items-center gap-2 border-b border-border', recolhido ? 'justify-center px-2' : 'pl-4 pr-2')}>
        {!recolhido && (
          <>
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-semibold text-brand-foreground">E</span>
            <span className="flex-1 truncate text-base font-semibold text-foreground">Escritório</span>
          </>
        )}
        {/* No topo (e não no rodapé) para não disputar o canto inferior esquerdo com avisos e o indicador do Next em desenvolvimento. */}
        {onAlternar && (
          <button
            type="button"
            onClick={onAlternar}
            aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!recolhido}
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground"
          >
            {recolhido ? <PanelLeftOpen aria-hidden size={20} strokeWidth={1.75} /> : <PanelLeftClose aria-hidden size={20} strokeWidth={1.75} />}
          </button>
        )}
      </div>

      <nav aria-label="Menu principal" className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          {itens.map((item, i) => {
            const Icone = ICONES[item.href] ?? House;
            const atual = ativo(pathname, item.href);
            const contador = contadorDo(item.href, contadores);
            const idDescricao = contador ? `menu-contador-${contador.tipo}${onNavegar ? '-gaveta' : ''}` : undefined;
            const separar = ADMINISTRACAO.has(item.href) && !ADMINISTRACAO.has(itens[i - 1]?.href ?? '');
            const rotuloSelo = rotuloContador(contador?.n);
            const link = (
              <Link
                href={item.href}
                onClick={onNavegar}
                aria-current={atual ? 'page' : undefined}
                aria-describedby={idDescricao}
                className={cn(
                  'relative flex h-9 items-center gap-3 rounded-md text-base transition-colors duration-150 ease-out',
                  recolhido ? 'justify-center px-0' : 'px-2.5',
                  atual ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-surface-muted hover:text-foreground',
                )}
              >
                <Icone aria-hidden size={20} strokeWidth={1.75} className="shrink-0" />
                <span className={cn('flex-1 truncate', recolhido && 'sr-only')}>{item.rotulo}</span>
                {contador && rotuloSelo && recolhido && (
                  // Recolhido: só um ponto no canto, fora do ícone; o número fica no tooltip e na descrição acessível.
                  <span
                    aria-hidden
                    className={cn(
                      'absolute right-1.5 top-1.5 size-2 rounded-full ring-2 ring-surface',
                      contador.tipo === 'atendimento' ? 'bg-warning' : 'bg-subtle',
                    )}
                  />
                )}
                {contador && rotuloSelo && !recolhido && (
                  <span
                    aria-hidden
                    className={cn(
                      'tabular inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1 text-xs font-semibold',
                      contador.tipo === 'atendimento' ? 'bg-warning text-warning-foreground' : 'bg-surface-muted text-muted',
                    )}
                  >
                    {rotuloSelo}
                  </span>
                )}
                {contador && <span id={idDescricao} hidden>{descricaoContador(contador.tipo, contador.n)}</span>}
              </Link>
            );
            return (
              <Fragment key={item.href}>
                {separar && <li role="separator" className="mx-2 my-2 h-px bg-border" />}
                <li>
                  {recolhido ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">
                        {item.rotulo}
                        {contador ? ` · ${descricaoContador(contador.tipo, contador.n)}` : ''}
                      </TooltipContent>
                    </Tooltip>
                  ) : link}
                </li>
              </Fragment>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
