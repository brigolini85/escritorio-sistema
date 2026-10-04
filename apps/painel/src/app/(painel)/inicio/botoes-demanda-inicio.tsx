'use client';

import { CircleCheck, Hand } from 'lucide-react';
import { useTransition } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { assumirDemanda, concluirDemanda, type Resultado } from '../demandas/acoes';

const avisar = (r: Resultado) => (r.ok ? toast.success(r.mensagem) : toast.error(r.erro));

/** CONCLUIR da Minha mesa: a mesma ação e a mesma confirmação do painel lateral (D12, D14). */
export function BotaoConcluirInicio({ id, numero, titulo }: { id: string; numero: number; titulo: string }) {
  return (
    <ConfirmDialog
      gatilho={(
        <Button type="button" variant="outline" size="sm" aria-label={`Concluir a demanda #${numero}`}>
          <CircleCheck aria-hidden size={16} strokeWidth={1.75} />Concluir
        </Button>
      )}
      titulo={<>Concluir a demanda <strong>#{numero}</strong>?</>}
      descricao={`"${titulo}" sai das demandas abertas. Dá para reabrir depois.`}
      confirmar="Concluir"
      enviando="Concluindo…"
      variante="primary"
      tipo="concluir"
      acao={async () => { avisar(await concluirDemanda(id)); }}
    />
  );
}

/** ASSUMIR: a função do banco recusa demanda já com outra pessoa ("A demanda já está com …") e o aviso diz isso. */
export function BotaoAssumirInicio({ id, numero }: { id: string; numero: number }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button type="button" size="sm" disabled={pendente} aria-label={`Assumir a demanda #${numero}`}
      onClick={() => iniciar(async () => { avisar(await assumirDemanda(id)); })}>
      <Hand aria-hidden size={16} strokeWidth={1.75} />{pendente ? 'Assumindo…' : 'Assumir'}
    </Button>
  );
}
