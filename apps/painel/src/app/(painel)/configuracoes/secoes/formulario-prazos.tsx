'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { toast } from '@/components/ui/toaster';
import type { ImpactoPrazo } from '@/lib/configuracoes';
import { salvarPrazos, simularPrazos } from '../acoes';
import { FormularioConfig } from '../formulario-config';
import { JanelaImpacto, type Escolha } from './janela-impacto';

/**
 * Prazos (spec 7C.4): antes de salvar, simula; com demanda aberta de uma prioridade mudada, abre a janela e espera a
 * escolha. Vale também no "Salvar e sair" da janela de saída (D15): o salvarParaSair do FormularioConfig passa por aqui.
 */
export function FormularioPrazos({ children }: { children: ReactNode }) {
  const [impactos, setImpactos] = useState<ImpactoPrazo[] | null>(null);
  const resposta = useRef<((e: Escolha) => void) | null>(null);
  const antesDeEnviar = useCallback(async (dados: FormData): Promise<boolean> => {
    const s = await simularPrazos(dados);
    if (!s.ok) {
      toast.error(s.erro);
      return false;
    }
    if (s.semImpacto) dados.set('semImpacto', 'sim');
    if (!s.impactos.some((i) => i.abertas > 0)) return true;
    setImpactos(s.impactos);
    const escolha = await new Promise<Escolha>((res) => { resposta.current = res; });
    setImpactos(null);
    if (escolha === 'cancelar') return false;
    if (escolha === 'aplicar') dados.set('aplicar', 'sim');
    return true;
  }, []);
  return (
    <>
      <FormularioConfig acao={salvarPrazos} rotulo="Prazos por prioridade" antesDeEnviar={antesDeEnviar}>
        {children}
      </FormularioConfig>
      <JanelaImpacto
        impactos={impactos}
        escolher={(e) => {
          const r = resposta.current;
          resposta.current = null;
          r?.(e);
        }}
      />
    </>
  );
}
