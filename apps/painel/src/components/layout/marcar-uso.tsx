'use client';

import { useEffect } from 'react';
import { cookieDeUso, INTERVALO_MARCA_USO_MS } from '@/lib/marca-uso';

/** Toques que contam como uso: clique/toque na tela, tecla e rolagem. */
const EVENTOS = ['pointerdown', 'keydown', 'wheel'] as const;

/**
 * Regra de 1 h sem uso (sessao-limites.ts, momentoDoUso): grava no cookie `painel_uso` o último toque da pessoa.
 * Recargas automáticas (tempo real, a cada minuto) mandam o mesmo valor velho e não esticam a sessão; um clique no
 * menu grava antes de o pedido sair (fase de captura). `agoraServidor` corrige o relógio do computador.
 */
export function MarcarUso({ agoraServidor }: { agoraServidor: number }) {
  useEffect(() => {
    const desvioMs = agoraServidor - Date.now();
    let ultima = 0;
    const marcar = () => {
      const agora = Date.now();
      if (agora - ultima < INTERVALO_MARCA_USO_MS) return;
      ultima = agora;
      document.cookie = cookieDeUso({ agoraNavegador: agora, desvioMs, https: location.protocol === 'https:' });
    };
    for (const e of EVENTOS) window.addEventListener(e, marcar, { capture: true, passive: true });
    return () => {
      for (const e of EVENTOS) window.removeEventListener(e, marcar, { capture: true });
    };
  }, [agoraServidor]);
  return null;
}
