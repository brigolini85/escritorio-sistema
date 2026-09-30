'use client';

import { CircleAlert, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { enderecoSemErro } from '@/lib/erro-na-url';

/** Devolve a função que tira o `?erro=` da URL atual, sem rolar a página e sem nova entrada no histórico. */
export function useTirarErroDaUrl(): () => void {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  return useCallback(() => {
    router.replace(enderecoSemErro(caminho, params.toString()), { scroll: false });
  }, [router, caminho, params]);
}

/**
 * Aviso da última tentativa que falhou (`?erro=` que as server actions devolvem).
 * - `prefixo`: texto antes do erro (ex.: "Não foi possível salvar: ").
 * - `limparDaUrl`: mostra o aviso e tira o `?erro=` da URL, para ele não voltar na próxima ação nem ao recarregar;
 *   o mesmo erro de novo muda a URL e aparece de novo. Com ele, o aviso ganha botão de fechar.
 */
export function AvisoErro({ erro, prefixo = '', limparDaUrl = false }: { erro?: string | null; prefixo?: string; limparDaUrl?: boolean }) {
  const [aviso, setAviso] = useState(erro ?? null);
  const tirarErroDaUrl = useTirarErroDaUrl();

  useEffect(() => {
    if (!erro) {
      // Com limparDaUrl o ?erro= sai da URL de propósito e o aviso fica; sem ele, sumir da URL é sumir da tela.
      if (!limparDaUrl) setAviso(null);
      return;
    }
    setAviso(erro);
    if (limparDaUrl) tirarErroDaUrl();
  }, [erro, limparDaUrl, tirarErroDaUrl]);

  if (!aviso) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
      <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <p className="flex-1">{prefixo}{aviso}</p>
      {limparDaUrl && (
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={() => setAviso(null)}
          className="-m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X aria-hidden size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
