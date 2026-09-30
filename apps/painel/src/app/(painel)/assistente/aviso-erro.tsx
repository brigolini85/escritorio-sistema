'use client';
import { CircleAlert, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Aviso de erro da pergunta (?erro= que a ação devolve). Mostra o aviso e tira o ?erro= da URL, para que ele
 * não volte depois da próxima pergunta nem ao recarregar; o mesmo erro de novo muda a URL e aparece de novo.
 */
export function AvisoErro({ erro }: { erro?: string }) {
  const [aviso, setAviso] = useState(erro ?? null);
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (!erro) return;
    setAviso(erro);
    const outros = new URLSearchParams(params.toString());
    outros.delete('erro');
    const resto = outros.toString();
    router.replace(resto ? `${caminho}?${resto}` : caminho, { scroll: false });
  }, [erro, params, caminho, router]);

  if (!aviso) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
      <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <p className="flex-1">{aviso}</p>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => setAviso(null)}
        className="-m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X aria-hidden size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}
