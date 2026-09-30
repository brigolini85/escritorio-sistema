'use client';

import { ShieldAlert } from 'lucide-react';
import { unstable_rethrow } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { ConfirmDialog } from './confirm-dialog';

/**
 * "Apagar dados (LGPD)" de um contato: confirmação que exige digitar o nome e o mesmo texto em todas as telas.
 * `acao` é anonimizarContato já com clienteId e contatoId presos por .bind no servidor; o hidden confirmo=on vai junto,
 * como a antiga caixa "confirmo". Se a ação falhar, a janela fecha e aparece um aviso (nada de tela de erro).
 */
export function ApagarDadosContato({ nome, acao, variante = 'discreto' }: {
  nome: string;
  acao: (dados: FormData) => Promise<void>;
  /** discreto: botão fantasma na linha; destaque: botão vermelho da zona de perigo. */
  variante?: 'discreto' | 'destaque';
}) {
  const enviar = async (dados: FormData) => {
    try {
      await acao(dados);
    } catch (e) {
      unstable_rethrow(e); // redirecionamento do Next continua valendo
      console.error('[lgpd] falha ao apagar os dados do contato', e);
      toast.error(`Não consegui concluir o apagamento dos dados de ${nome}. Tente de novo; se continuar, avise o administrador.`);
    }
  };
  return (
    <ConfirmDialog
      gatilho={variante === 'destaque' ? (
        <Button type="button" variant="danger" size="sm" className="self-start">Apagar dados (LGPD)</Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" className={cn('text-danger hover:bg-danger-soft')}>
          <ShieldAlert aria-hidden size={16} strokeWidth={1.75} />
          Apagar dados (LGPD)
        </Button>
      )}
      titulo={`Apagar os dados de ${nome}?`}
      descricao="A pedido do titular (LGPD): nome, telefone, mensagens, áudios e arquivos deste contato são apagados de vez, em todas as empresas. As conversas ficam, mas sem o conteúdo. Não dá para desfazer."
      confirmar="Apagar dados"
      enviando="Apagando…"
      digitarParaConfirmar={nome}
      acao={enviar}
    >
      <input type="hidden" name="confirmo" value="on" />
    </ConfirmDialog>
  );
}
