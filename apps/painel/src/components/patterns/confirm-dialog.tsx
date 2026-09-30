'use client';

import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { textoConfere } from './confirmacao';

type Base = {
  /** Botão que abre a confirmação (ex.: <Button variant="danger">Concluir</Button>). */
  gatilho: ReactElement;
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Texto do botão que envia; o mesmo verbo da ação ("Concluir", "Apagar dados"). */
  confirmar: string;
  /** Texto enquanto envia, ex.: "Concluindo…". */
  enviando?: string;
  variante?: 'primary' | 'danger';
  /** Exige digitar este texto (ex.: o nome do contato) antes de liberar o botão. */
  digitarParaConfirmar?: string;
};

/**
 * Confirmação de ação destrutiva ou irreversível (concluir, apagar dados LGPD, pausar o agente) em cima
 * de um formulário de server action que já existe, sem mudar os campos. Dois jeitos:
 * - `acao` + `children`: o <form action={acao}> fica dentro da janela, com os campos (hidden) passados em children;
 * - `formulario="id"`: o formulário continua na página (com todos os campos) e o botão da janela é o submit dele
 *   (atributo form=), então nada muda no que é enviado.
 * O campo "digite para confirmar" não tem name: não vai junto com o formulário.
 */
export function ConfirmDialog(props: Base & ({ acao: (dados: FormData) => void | Promise<void>; children?: ReactNode; formulario?: never } | { formulario: string; acao?: never; children?: never })) {
  const { gatilho, titulo, descricao, confirmar, enviando, variante = 'danger', digitarParaConfirmar } = props;
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState('');
  const idDigitar = useId();
  const liberado = !digitarParaConfirmar || textoConfere(digitado, digitarParaConfirmar);

  // Formulário externo: fecha a janela depois que o envio começou (fechar no clique cortaria o submit).
  const externo = 'formulario' in props ? props.formulario : undefined;
  useEffect(() => {
    if (!aberto || !externo) return;
    const form = document.getElementById(externo);
    if (!(form instanceof HTMLFormElement)) return;
    const aoEnviar = () => setTimeout(() => setAberto(false), 0);
    form.addEventListener('submit', aoEnviar);
    return () => form.removeEventListener('submit', aoEnviar);
  }, [aberto, externo]);

  const mudarAberto = (v: boolean) => {
    setAberto(v);
    if (!v) setDigitado('');
  };

  const campoDigitar = digitarParaConfirmar && (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={idDigitar} className="block">
        Para confirmar, digite <strong className="font-semibold">{digitarParaConfirmar}</strong>
      </Label>
      <Input id={idDigitar} value={digitado} onChange={(e) => setDigitado(e.target.value)} autoComplete="off" spellCheck={false} />
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao ? <DialogDescription>{descricao}</DialogDescription> : <DialogDescription className="sr-only">Confirme a ação.</DialogDescription>}
        </DialogHeader>
        {'acao' in props && props.acao ? (
          <form action={props.acao} className="grid gap-4">
            {props.children}
            {campoDigitar}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <BotaoEnviar rotulo={confirmar} enviando={enviando} variante={variante} liberado={liberado} aoTerminar={() => mudarAberto(false)} />
            </DialogFooter>
          </form>
        ) : (
          <div className="grid gap-4">
            {campoDigitar}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" form={externo} variant={variante} disabled={!liberado}>{confirmar}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Submit dentro do form: mostra "enviando" e fecha a janela quando a ação termina (erro volta pela página com ?erro=). */
function BotaoEnviar({ rotulo, enviando, variante, liberado, aoTerminar }: { rotulo: string; enviando?: string; variante: 'primary' | 'danger'; liberado: boolean; aoTerminar: () => void }) {
  const { pending } = useFormStatus();
  const antes = useRef(false);
  useEffect(() => {
    if (antes.current && !pending) aoTerminar();
    antes.current = pending;
  }, [pending, aoTerminar]);
  return (
    <Button type="submit" variant={variante} disabled={!liberado || pending} aria-disabled={!liberado || pending}>
      {pending ? enviando ?? `${rotulo}…` : rotulo}
    </Button>
  );
}
