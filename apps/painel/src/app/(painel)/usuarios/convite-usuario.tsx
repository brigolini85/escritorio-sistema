'use client';

import { UserPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDescarteProtegido } from '@/components/patterns/formulario-alteravel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { FormularioUsuario, type SetorOpcao } from './formulario-usuario';

type Acao = (dados: FormData) => void | Promise<void>;

/**
 * "Convidar pessoa": janela com o mesmo formulário de antes (action convidarUsuario, botão "Enviar convite").
 * Fecha quando o envio termina. Se o servidor recusar, o aviso aparece na página (?erro=). Deu certo quando a
 * lista que volta do servidor passa a ter o e-mail convidado: aí aparece "Convite enviado para …" (a ação não
 * devolve nada, então é assim que se sabe). Fechar com alterações pede confirmação.
 */
export function ConviteUsuario({ acao, setores, emails }: { acao: Acao; setores: SetorOpcao[]; /** E-mails das pessoas já cadastradas. */ emails: string[] }) {
  const [aberto, setAberto] = useState(false);
  const conteudo = useRef<HTMLDivElement>(null);
  const email = useRef('');
  const { tentarFechar, janela } = useDescarteProtegido();

  const [esperando, setEsperando] = useState<string | null>(null);
  // No envio: o e-mail convidado e se ele já estava na lista (aí o servidor recusa e não é sucesso).
  const jaExistia = useRef(false);
  const terminou = useCallback(() => {
    setAberto(false);
    if (email.current && !jaExistia.current) setEsperando(email.current);
  }, []);

  useEffect(() => {
    if (!esperando) return;
    if (emails.includes(esperando)) {
      toast.success(`Convite enviado para ${esperando}.`, { id: `convite-${esperando}` });
      setEsperando(null);
      return;
    }
    // Sem a pessoa na lista depois de um tempo: o envio foi recusado (o aviso de erro está na página).
    const t = setTimeout(() => setEsperando(null), 10_000);
    return () => clearTimeout(t);
  }, [emails, esperando]);

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
      <DialogContent
        ref={conteudo}
        className="flex max-h-dvh flex-col gap-0 p-0 sm:max-w-2xl"
        onSubmitCapture={(e) => {
          const campo = (e.target as HTMLFormElement).elements.namedItem('email');
          email.current = campo instanceof HTMLInputElement ? campo.value.trim().toLowerCase() : '';
          jaExistia.current = emails.includes(email.current);
        }}
      >
        <DialogHeader className="border-b border-border p-4 pr-12">
          <DialogTitle>Convidar pessoa</DialogTitle>
          <DialogDescription>Ela recebe um e-mail para definir a senha.</DialogDescription>
        </DialogHeader>
        <FormularioUsuario acao={acao} setores={setores} enviar="Enviar convite" aoTerminar={terminou} />
        {janela}
      </DialogContent>
    </Dialog>
  );
}
