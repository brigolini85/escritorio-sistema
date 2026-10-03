'use client';

import type { ReactNode } from 'react';
import { FormularioAlteravel } from '@/components/patterns/formulario-alteravel';
import { toast } from '@/components/ui/toaster';
import { salvarLimitesEspera } from './acoes';

/** Formulário dos limites de espera: o resultado da ação vira aviso (o erro de validação não recarrega a página). */
export function FormularioEspera({ children }: { children: ReactNode }) {
  return (
    <FormularioAlteravel
      action={async (dados) => {
        const r = await salvarLimitesEspera(dados);
        if (r.ok) toast.success(r.mensagem);
        else toast.error(r.erro);
      }}
    >
      {children}
    </FormularioAlteravel>
  );
}
