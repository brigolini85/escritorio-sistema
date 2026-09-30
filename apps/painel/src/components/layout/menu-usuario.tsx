'use client';

import { ChevronDown, Keyboard, LogOut } from 'lucide-react';
import { useRef } from 'react';
import { sair } from '@/app/entrar/acoes';
import { OPCOES_TEMA, useEscolhaTema } from '@/components/tema/alternador-tema';
import type { EscolhaTema } from '@/components/tema/tema';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EVENTO_ABRIR_ATALHOS } from './atalhos';

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const [a, b] = [partes[0], partes.length > 1 ? partes[partes.length - 1] : undefined];
  return ((a?.[0] ?? '') + (b?.[0] ?? '')).toUpperCase() || '?';
}

/** Menu da pessoa logada: nome, papel, tema e Sair (mesma server action de antes). */
export function MenuUsuario({ nome, papel, tema }: { nome: string; papel: 'admin' | 'atendente'; tema: EscolhaTema }) {
  const [escolha, escolher] = useEscolhaTema(tema);
  const gatilho = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        ref={gatilho}
        aria-label="Menu do usuário"
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-1.5 text-base text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted data-[state=open]:bg-surface-muted"
      >
        <Avatar className="size-7">
          <AvatarFallback className="bg-brand-soft text-brand">{iniciais(nome)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-40 truncate md:inline">{nome}</span>
        <ChevronDown aria-hidden size={16} strokeWidth={1.75} className="text-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-base font-medium text-foreground">{nome}</span>
          <span className="text-xs font-normal text-muted">{papel === 'admin' ? 'Administrador' : 'Atendente'}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={escolha} onValueChange={escolher}>
          {OPCOES_TEMA.map(({ valor, rotulo, Icone }) => (
            <DropdownMenuRadioItem key={valor} value={valor} onSelect={(e) => e.preventDefault()}>
              <Icone aria-hidden size={16} strokeWidth={1.75} className="text-muted" />
              {rotulo}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ATALHOS, { detail: gatilho.current }))}>
          <Keyboard aria-hidden size={16} strokeWidth={1.75} className="text-muted" />
          Atalhos do teclado
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        {/* O menu fica aberto no clique (preventDefault) para o botão continuar no DOM e o formulário ser enviado. */}
        <form action={sair}>
          <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut aria-hidden size={16} strokeWidth={1.75} className="text-muted" />
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
