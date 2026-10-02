'use client';

import { ChevronDown, Keyboard, LogOut } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
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
import { definirTamanhoLetra } from './acoes-perfil';
import { EVENTO_ABRIR_ATALHOS } from './atalhos';
import { classeDoTamanho, OPCOES_LETRA, tamanhoDoValor, type TamanhoLetra } from './tamanho-letra';

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const [a, b] = [partes[0], partes.length > 1 ? partes[partes.length - 1] : undefined];
  return ((a?.[0] ?? '') + (b?.[0] ?? '')).toUpperCase() || '?';
}

// Põe no <html> a classe do tamanho (ou nenhuma, no normal), trocando a anterior na hora.
function aplicarClasseLetra(t: TamanhoLetra) {
  const lista = document.documentElement.classList;
  lista.remove('letra-grande', 'letra-maior');
  const classe = classeDoTamanho(t);
  if (classe) lista.add(classe);
}

/** Menu da pessoa logada: nome, papel, tema, tamanho da letra e Sair (mesma server action de antes). */
export function MenuUsuario({
  nome,
  papel,
  tema,
  tamanhoLetra,
}: {
  nome: string;
  papel: 'admin' | 'atendente';
  tema: EscolhaTema;
  tamanhoLetra: TamanhoLetra;
}) {
  const [escolha, escolher] = useEscolhaTema(tema);
  const [letra, setLetra] = useState(tamanhoLetra);

  async function escolherLetra(valor: string) {
    const novo = tamanhoDoValor(valor);
    const anterior = letra;
    setLetra(novo);
    aplicarClasseLetra(novo);
    const r = await definirTamanhoLetra(novo);
    if (!r.ok) {
      // Não gravou: volta ao tamanho anterior para a tela não mentir.
      setLetra(anterior);
      aplicarClasseLetra(anterior);
      toast.error(r.erro);
    }
  }

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
        <DropdownMenuLabel>Tamanho da letra</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={letra} onValueChange={escolherLetra}>
          {OPCOES_LETRA.map(({ valor, rotulo }) => (
            <DropdownMenuRadioItem key={valor} value={valor} onSelect={(e) => e.preventDefault()}>
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
