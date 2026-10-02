'use client';

import { ChevronDown, Keyboard, LogOut } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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
import { classeDoTamanho, cookieDoTamanho, lerCookieLetra, OPCOES_LETRA, precisaSincronizarLetra, tamanhoDoValor, type TamanhoLetra } from './tamanho-letra';

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

type PreferenciasPessoa = {
  nome: string;
  papel: 'admin' | 'atendente';
  escolha: EscolhaTema;
  escolher: (valor: string) => void;
  letra: TamanhoLetra;
  escolherLetra: (valor: string) => Promise<void>;
};

// Dois menus (barra do topo e atalho "Meu perfil") mostram o mesmo tema e tamanho: o estado mora num lugar só.
const ContextoPessoa = createContext<PreferenciasPessoa | null>(null);

/** Guarda nome, papel, tema e tamanho da letra da pessoa para todos os menus da pessoa na casca. */
export function ProvedorMenuUsuario({
  nome,
  papel,
  tema,
  tamanhoLetra,
  children,
}: {
  nome: string;
  papel: 'admin' | 'atendente';
  tema: EscolhaTema;
  tamanhoLetra: TamanhoLetra;
  children: ReactNode;
}) {
  const [escolha, escolher] = useEscolhaTema(tema);
  const [letra, setLetra] = useState(tamanhoLetra);

  // O perfil manda: se mudou noutro lugar, o seletor do menu acompanha a prop.
  useEffect(() => {
    setLetra(tamanhoLetra);
  }, [tamanhoLetra]);

  // O perfil manda: se o cookie expirou ou o tamanho mudou noutro aparelho, acerta a classe do <html> e o cookie.
  useEffect(() => {
    if (!precisaSincronizarLetra(lerCookieLetra(document.cookie), tamanhoLetra)) return;
    aplicarClasseLetra(tamanhoLetra);
    document.cookie = cookieDoTamanho(tamanhoLetra);
  }, [tamanhoLetra]);

  async function escolherLetra(valor: string) {
    const novo = tamanhoDoValor(valor);
    const anterior = letra;
    const cookieAnterior = lerCookieLetra(document.cookie);
    setLetra(novo);
    aplicarClasseLetra(novo);
    // Cookie já na hora: recarregar antes de a gravação terminar não pode trazer o tamanho antigo.
    document.cookie = cookieDoTamanho(novo);
    // Não gravou (erro do servidor ou da rede): volta ao tamanho anterior (tela e cookie) para a tela não mentir.
    const voltar = (erro: string) => {
      setLetra(anterior);
      aplicarClasseLetra(anterior);
      document.cookie = cookieDoTamanho(tamanhoDoValor(cookieAnterior ?? anterior));
      toast.error(erro);
    };
    try {
      const r = await definirTamanhoLetra(novo);
      if (!r.ok) voltar(r.erro);
    } catch {
      voltar('Não deu para guardar o tamanho da letra.');
    }
  }

  return (
    <ContextoPessoa.Provider value={{ nome, papel, escolha, escolher, letra, escolherLetra }}>{children}</ContextoPessoa.Provider>
  );
}

function usePessoa(): PreferenciasPessoa {
  const ctx = useContext(ContextoPessoa);
  if (!ctx) throw new Error('MenuUsuario precisa estar dentro de ProvedorMenuUsuario');
  return ctx;
}

/** Conteúdo do menu da pessoa: nome, papel, tema, tamanho da letra, atalhos e Sair (mesma server action de antes). */
export function ConteudoMenuUsuario({
  gatilho,
  side,
  align = 'end',
}: {
  /** Quem abriu o menu: recebe o foco de volta quando a lista de atalhos fecha. */
  gatilho: RefObject<HTMLElement | null>;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}) {
  const { nome, papel, escolha, escolher, letra, escolherLetra } = usePessoa();
  return (
    <DropdownMenuContent side={side} align={align} className="w-56">
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
  );
}

/**
 * Menu da pessoa logada. Sem `gatilho`, usa o botão com avatar e nome da barra do topo; com `gatilho`
 * (um botão, como o atalho "Meu perfil" do menu lateral), abre o mesmo conteúdo a partir dele.
 */
export function MenuUsuario({
  gatilho,
  side,
  align,
}: {
  gatilho?: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}) {
  const { nome } = usePessoa();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu modal={false}>
      {gatilho ? (
        <DropdownMenuTrigger ref={ref} asChild>
          {gatilho}
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          ref={ref}
          aria-label="Menu do usuário"
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-1.5 text-base text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted data-[state=open]:bg-surface-muted"
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-brand-soft text-brand">{iniciais(nome)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate md:inline">{nome}</span>
          <ChevronDown aria-hidden size={16} strokeWidth={1.75} className="text-muted" />
        </DropdownMenuTrigger>
      )}
      <ConteudoMenuUsuario gatilho={ref} side={side} align={align ?? (side === 'right' ? 'start' : 'end')} />
    </DropdownMenu>
  );
}
