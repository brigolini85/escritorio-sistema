'use client';

import { UserPlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useDescarteProtegido } from '@/components/patterns/formulario-alteravel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { EstadoUsuario } from './esquemas';
import { FormularioUsuario, type SetorOpcao } from './formulario-usuario';

type Acao = (dados: FormData) => Promise<EstadoUsuario>;

/**
 * "Convidar pessoa": janela com o formulário de sempre (action convidarUsuario, botão "Enviar convite").
 * Erro fica no campo, com a janela aberta; deu certo, fecha e avisa "Convite enviado para …".
 * Fechar com alterações pede confirmação.
 */
export function ConviteUsuario({ acao, setores }: { acao: Acao; setores: SetorOpcao[] }) {
  const [aberto, setAberto] = useState(false);
  const conteudo = useRef<HTMLDivElement>(null);
  const { tentarFechar, janela } = useDescarteProtegido();

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (v) setAberto(true);
        else tentarFechar(conteudo.current, () => setAberto(false));
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden size={16} strokeWidth={1.75} />
          Convidar pessoa
        </Button>
      </DialogTrigger>
      <DialogContent ref={conteudo} className="flex max-h-dvh flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border p-4 pr-12">
          <DialogTitle>Convidar pessoa</DialogTitle>
          <DialogDescription>Ela recebe um e-mail para definir a senha.</DialogDescription>
        </DialogHeader>
        <FormularioUsuario acao={acao} setores={setores} enviar="Enviar convite" aoSalvar={() => setAberto(false)} />
        {janela}
      </DialogContent>
    </Dialog>
  );
}
