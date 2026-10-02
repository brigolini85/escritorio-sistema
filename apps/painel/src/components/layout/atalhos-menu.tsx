'use client';

import { House, MessageCircle, Power, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { sair } from '@/app/entrar/acoes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { ROTULO_SITUACAO, type SituacaoSinal } from '@/lib/sinal-vida';
import { MenuUsuario } from './menu-usuario';

// Quadrado comum aos quatro atalhos; a borda (cor do módulo) vem de cada um.
const QUADRADO =
  'relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 bg-sidebar-raised text-sidebar-foreground transition-colors duration-150 ease-out hover:bg-sidebar-border focus-visible:outline-champagne';

// O ponto acompanha o texto do aria-label e da dica: a cor nunca fala sozinha.
const COR_PONTO: Record<SituacaoSinal, string> = {
  ok: 'bg-success',
  atrasado: 'bg-warning-decor',
  parado: 'bg-danger',
  sem_sinal: 'bg-danger',
};

// A dica repete o aria-label; cada gatilho zera o aria-describedby do Radix (props do filho vencem no Slot)
// para o leitor de tela não ouvir "Início, Início".
function Dica({ rotulo, children }: { rotulo: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{rotulo}</TooltipContent>
    </Tooltip>
  );
}

/** Quatro atalhos quadrados no topo do menu: Início, Meu perfil, estado do WhatsApp e Sair. */
export function AtalhosMenu({ recolhido = false, whatsapp }: { recolhido?: boolean; whatsapp: SituacaoSinal | null }) {
  const rotuloZap = whatsapp ? `WhatsApp: ${ROTULO_SITUACAO[whatsapp]}` : 'WhatsApp';
  return (
    <div className={cn('flex items-center justify-center gap-2', recolhido && 'flex-col')}>
      <Dica rotulo="Início">
        <Link href="/inicio" aria-label="Início" aria-describedby={undefined} className={cn(QUADRADO, 'border-modulo-inicio')}>
          <House aria-hidden size={18} strokeWidth={1.75} />
        </Link>
      </Dica>

      {/* Tooltip por fora do menu: o botão é ao mesmo tempo gatilho da dica e do menu da pessoa. */}
      <Tooltip>
        <MenuUsuario
          side="right"
          gatilho={
            <TooltipTrigger asChild>
              <button type="button" aria-label="Meu perfil" aria-describedby={undefined} className={cn(QUADRADO, 'border-modulo-clientes')}>
                <UserRound aria-hidden size={18} strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
          }
        />
        <TooltipContent side="right">Meu perfil</TooltipContent>
      </Tooltip>

      {whatsapp ? (
        <Dica rotulo={rotuloZap}>
          <Link href="/configuracoes#integracoes" aria-label={rotuloZap} aria-describedby={undefined} className={cn(QUADRADO, 'border-modulo-atendimento')}>
            <MessageCircle aria-hidden size={18} strokeWidth={1.75} />
            <span aria-hidden className={cn('absolute -right-1 -top-1 size-2 rounded-full ring-2 ring-sidebar', COR_PONTO[whatsapp])} />
          </Link>
        </Dica>
      ) : (
        // Quem não é administrador não lê os sinais de vida (RLS): só o ícone, sem ponto e sem link.
        <span
          aria-label="WhatsApp"
          role="img"
          title="O estado do WhatsApp só o administrador vê"
          className={cn(QUADRADO, 'cursor-default border-modulo-atendimento hover:bg-sidebar-raised')}
        >
          <MessageCircle aria-hidden size={18} strokeWidth={1.75} />
        </span>
      )}

      <form action={sair} className="contents">
        <Dica rotulo="Sair">
          <button type="submit" aria-label="Sair" aria-describedby={undefined} className={cn(QUADRADO, 'border-danger')}>
            <Power aria-hidden size={18} strokeWidth={1.75} />
          </button>
        </Dica>
      </form>
    </div>
  );
}
