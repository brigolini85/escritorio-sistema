'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from '@/components/ui/toaster';
import { enderecoSemAviso, PARAM_AVISO, textoDoAviso } from '@/lib/avisos';

/**
 * Aviso de sucesso que uma server action devolve pela URL (`?aviso=código`): mostra no canto e tira da URL,
 * para não voltar ao recarregar. Fica mais tempo na tela porque conta algo que a pessoa precisa saber.
 */
export function AvisoDaUrl() {
  const caminho = usePathname();
  const params = useSearchParams();
  const codigo = params.get(PARAM_AVISO);

  useEffect(() => {
    if (!codigo) return;
    const texto = textoDoAviso(codigo);
    // id fixo: o efeito rodando duas vezes (modo estrito) não empilha o mesmo aviso.
    if (texto) toast.success(texto, { id: `aviso-${codigo}`, duration: 10_000 });
    // Depois do commit: o Next grava o endereço do redirect da ação no histórico depois dos efeitos dos filhos,
    // e uma troca feita agora seria sobrescrita. Só troca o endereço, sem buscar a página de novo.
    const espera = window.setTimeout(() => window.history.replaceState(null, '', enderecoSemAviso(caminho, params.toString())), 0);
    return () => window.clearTimeout(espera);
  }, [codigo, caminho, params]);

  return null;
}
