'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ignorarAtalho } from '@/components/layout/atalhos';
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
  /** Aviso de erro do assistente (?erro=), guardado aqui porque o parâmetro sai da URL depois de mostrado. */
  avisoAtual: string | null;
};

const Contexto = createContext<Estado | null>(null);

export function useEstadoConversa(): Estado {
  const e = useContext(Contexto);
  if (!e) throw new Error('useEstadoConversa fora de EstadoConversa');
  return e;
}

/** O painel só recolhe a partir de lg; abaixo disso ele fica embaixo da conversa, sempre visível. */
const PAINEL_RECOLHIVEL = '(min-width: 1024px)';
/** De lg até 2xl o painel fica por cima do histórico (sobreposição): o foco entra nele ao abrir. */
export const PAINEL_SOBREPOSTO = '(min-width: 1024px) and (max-width: 1535.98px)';

const botaoPainel = () => document.getElementById('botao-painel-conversa');
const painel = () => document.getElementById('painel-conversa');

/**
 * Estado da tela da conversa compartilhado entre cabeçalho, compositor e painel lateral, e os atalhos
 * A (assumir), N (nota interna) e Esc (fecha o painel). J/K ficam em AtalhosLista.
 * O painel aberto/fechado fica no cookie (lido no servidor, a página já nasce certa).
 * `aviso`: erro vindo por ?erro= (redirect do assistente): abre o painel na aba Assistente para ele aparecer.
 */
export function EstadoConversa({
  children,
  painelInicial,
  abaInicial,
  demandaInicial,
  aviso,
}: {
  children: ReactNode;
  painelInicial: boolean;
  abaInicial: AbaPainel;
  demandaInicial: string | null;
  aviso?: string;
}) {
  const [painelAberto, setPainelAberto] = useState(painelInicial);
  const [aba, setAba] = useState<AbaPainel>(abaInicial);
  const [modo, setModo] = useState<ModoCompositor>('responder');
  const [demandaId, setDemandaId] = useState<string | null>(demandaInicial);
  const [avisoAtual, setAvisoAtual] = useState<string | null>(aviso ?? null);
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();

  const alternarPainel = useCallback((aberto?: boolean) => {
    if (!window.matchMedia(PAINEL_RECOLHIVEL).matches) return;
    const novo = aberto ?? !painelAberto;
    if (novo === painelAberto) return;
    document.cookie = cookiePainelConversa(novo);
    setPainelAberto(novo);
    if (!novo) {
      // O foco estava dentro do painel que vai sumir: volta para o botão que o reabre.
      if (painel()?.contains(document.activeElement)) setTimeout(() => botaoPainel()?.focus(), 0);
    } else if (window.matchMedia(PAINEL_SOBREPOSTO).matches) {
      // Sobreposição: o foco entra no painel (primeiro elemento focável).
      setTimeout(() => painel()?.querySelector<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')?.focus(), 0);
    }
  }, [painelAberto]);

  // Redirect com ?erro= (do assistente) para esta mesma conversa: guarda o aviso, abre o painel na aba Assistente
  // e tira o ?erro= da URL. Assim um segundo erro igual, logo depois, muda a URL de novo e reabre o painel.
  useEffect(() => {
    if (!aviso) return;
    setAvisoAtual(aviso);
    setPainelAberto(true);
    if (abaInicial === 'assistente') setAba('assistente');
    const resto = new URLSearchParams(params.toString());
    resto.delete('erro');
    const q = resto.toString();
    router.replace(q ? `${caminho}?${q}` : caminho, { scroll: false });
  }, [aviso, abaInicial, params, caminho, router]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Dentro do painel (até no campo do assistente) o Esc fecha o painel; fora dele, não atrapalha quem digita.
        const noPainel = e.target instanceof Node && painel()?.contains(e.target);
        const janelaAberta = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
        if (painelAberto && !e.defaultPrevented && !janelaAberta && (noPainel || !ignorarAtalho(e))) alternarPainel(false);
        return;
      }
      if (ignorarAtalho(e)) return;
      const tecla = e.key.toLowerCase();
      if (tecla === 'a') {
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
  }, [painelAberto, alternarPainel]);

  const valor = useMemo(
    () => ({ painelAberto, alternarPainel, aba, setAba, modo, setModo, demandaId, setDemandaId, avisoAtual }),
    [painelAberto, alternarPainel, aba, modo, demandaId, avisoAtual],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** A demanda escolhida, se ainda estiver aberta; senão a primeira. */
export function demandaEmFoco<T extends { id: string }>(demandas: T[], id: string | null): T | null {
  return demandas.find((d) => d.id === id) ?? demandas[0] ?? null;
}

/** Aviso de erro do assistente, na aba Assistente (continua na tela depois que ?erro= sai da URL). */
export function AvisoAssistente() {
  const { avisoAtual } = useEstadoConversa();
  if (!avisoAtual) return null;
  return <p role="alert" className="rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">{avisoAtual}</p>;
}
