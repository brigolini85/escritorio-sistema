'use client';

import { TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { EmptyState } from '@/components/patterns/empty-state';
import { Button } from '@/components/ui/button';

/**
 * Erro inesperado numa tela do painel (consulta ou server action que lançou erro): mensagem humana e "Tentar de novo",
 * sem stack trace. A casca (menu e barra do topo) continua na tela. O código (digest) ajuda a achar o erro no registro.
 */
export default function ErroDoPainel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [tentando, iniciar] = useTransition();

  useEffect(() => {
    console.error('[painel] erro na tela', error);
  }, [error]);

  return (
    <section role="alert" className="flex min-h-96 items-center justify-center rounded-lg border border-border bg-surface">
      <EmptyState
        icone={TriangleAlert}
        titulo="Algo deu errado nesta tela."
        descricao={(
          <>
            Não foi possível concluir o que foi pedido. Tente de novo; se continuar, avise o administrador.
            {error.digest && <span className="mt-2 block text-xs text-subtle">Código do erro: {error.digest}</span>}
          </>
        )}
        acao={(
          <Button
            type="button"
            size="sm"
            disabled={tentando}
            // Relê os dados do servidor e redesenha a tela (reset sozinho só redesenha o que já veio).
            onClick={() => iniciar(() => { router.refresh(); reset(); })}
          >
            {tentando ? 'Tentando…' : 'Tentar de novo'}
          </Button>
        )}
      />
    </section>
  );
}
