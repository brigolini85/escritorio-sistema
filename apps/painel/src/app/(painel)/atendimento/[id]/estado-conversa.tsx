'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cookiePainelConversa } from './preferencias-conversa';

export type ModoCompositor = 'responder' | 'nota';
export type AbaPainel = 'assistente' | 'detalhes';

type Estado = {
  painelAberto: boolean;
  alternarPainel: (aberto?: boolean) => void;
  aba: AbaPainel;
  setAba: (a: AbaPainel) => void;
  modo: ModoCompositor;
  setModo: (m: ModoCompositor) => void;
  /** Demanda escolhida (id) sobre a qual agem Transferir, Aguardando cliente, Concluir e a nota interna (quando há mais de uma aberta). Pode ter sido concluída numa atualização ao vivo: use demandaEmFoco(). */
  demandaId: string | null;
  setDemandaId: (id: string) => void;
};

const Contexto = createContext<Estado | null>(null);

export function useEstadoConversa(): Estado {
  const e = useContext(Contexto);
  if (!e) throw new Error('useEstadoConversa fora de EstadoConversa');
  return e;
}

/** Tecla digitada num campo, num menu ou numa janela aberta não é atalho. */
function ignorarAtalho(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return true;
  const alvo = e.target as HTMLElement | null;
  if (alvo?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="menu"], [role="listbox"]')) return true;
  return Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
}

/**
 * Estado da tela da conversa compartilhado entre cabeçalho, compositor e painel lateral, e os atalhos:
 * J/K próxima/anterior conversa da lista, A assumir, N nota interna, Esc fecha o painel lateral.
 * O painel aberto/fechado fica no cookie (lido no servidor, a página já nasce certa).
 */
export function EstadoConversa({
  children,
  painelInicial,
  abaInicial,
  demandaInicial,
}: {
  children: ReactNode;
  painelInicial: boolean;
  abaInicial: AbaPainel;
  demandaInicial: string | null;
}) {
  const router = useRouter();
  const [painelAberto, setPainelAberto] = useState(painelInicial);
  const [aba, setAba] = useState<AbaPainel>(abaInicial);
  const [modo, setModo] = useState<ModoCompositor>('responder');
  const [demandaId, setDemandaId] = useState<string | null>(demandaInicial);

  useEffect(() => { if (abaInicial === 'assistente') setAba('assistente'); }, [abaInicial]);

  const alternarPainel = useCallback((aberto?: boolean) => {
    setPainelAberto((atual) => {
      const novo = aberto ?? !atual;
      document.cookie = cookiePainelConversa(novo);
      return novo;
    });
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!ignorarAtalho(e) && painelAberto) alternarPainel(false);
        return;
      }
      if (ignorarAtalho(e)) return;
      const tecla = e.key.toLowerCase();
      if (tecla === 'j' || tecla === 'k') {
        const itens = [...document.querySelectorAll<HTMLAnchorElement>('a[data-conversa-item]')];
        if (!itens.length) return;
        const atual = itens.findIndex((a) => a.getAttribute('aria-current') === 'page');
        const destino = itens[Math.min(Math.max(atual + (tecla === 'j' ? 1 : -1), 0), itens.length - 1)];
        if (destino && destino !== itens[atual]) {
          e.preventDefault();
          destino.scrollIntoView({ block: 'nearest' });
          router.push(destino.getAttribute('href')!, { scroll: false });
        }
      } else if (tecla === 'a') {
        const botao = document.querySelector<HTMLButtonElement>('button[data-atalho="assumir"]');
        if (botao && !botao.disabled) {
          e.preventDefault();
          botao.click();
        }
      } else if (tecla === 'n') {
        const campo = document.querySelector<HTMLTextAreaElement>('textarea[data-atalho="nota"]');
        if (campo && !campo.disabled) {
          e.preventDefault();
          setModo('nota');
          // Depois de trocar o modo o campo fica visível e pode receber o foco.
          setTimeout(() => campo.focus(), 0);
        }
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [painelAberto, alternarPainel, router]);

  const valor = useMemo(
    () => ({ painelAberto, alternarPainel, aba, setAba, modo, setModo, demandaId, setDemandaId }),
    [painelAberto, alternarPainel, aba, modo, demandaId],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** A demanda escolhida, se ainda estiver aberta; senão a primeira. */
export function demandaEmFoco<T extends { id: string }>(demandas: T[], id: string | null): T | null {
  return demandas.find((d) => d.id === id) ?? demandas[0] ?? null;
}
