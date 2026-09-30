'use client';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';

/** Botões que disparam avisos (toasts) de exemplo no catálogo. */
export function DemoAvisos() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => toast('Resposta enviada ao cliente.')}>Aviso neutro</Button>
      <Button variant="outline" size="sm" onClick={() => toast.success('Demanda concluída.')}>Sucesso</Button>
      <Button variant="outline" size="sm" onClick={() => toast.warning('Teto de IA em 85%.')}>Atenção</Button>
      <Button variant="outline" size="sm" onClick={() => toast.error('Não foi possível salvar. Tente de novo.')}>Erro</Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.info('Nova conversa aguardando atendimento', { description: 'Padaria Pão Quente, há 1 min' })}
      >
        Tempo real
      </Button>
    </div>
  );
}
