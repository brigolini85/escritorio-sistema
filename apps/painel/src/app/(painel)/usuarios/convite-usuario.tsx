'use client';

import { UserPlus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormularioUsuario, type SetorOpcao } from './formulario-usuario';

type Acao = (dados: FormData) => void | Promise<void>;

/**
 * "Convidar pessoa": janela com o mesmo formulário de antes (action convidarUsuario, botão "Enviar convite").
 * Fecha quando o envio termina; se o servidor recusar, o aviso aparece na página (?erro=).
 */
export function ConviteUsuario({ acao, setores }: { acao: Acao; setores: SetorOpcao[] }) {
  const [aberto, setAberto] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden size={16} strokeWidth={1.75} />
          Convidar pessoa
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-dvh flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border p-4 pr-12">
          <DialogTitle>Convidar pessoa</DialogTitle>
          <DialogDescription>Ela recebe um e-mail para definir a senha.</DialogDescription>
        </DialogHeader>
        <FormularioUsuario acao={acao} setores={setores} enviar="Enviar convite" aoTerminar={fechar} />
      </DialogContent>
    </Dialog>
  );
}
