'use client';

import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Archive, CircleCheck, CircleHelp, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { APARENCIA_CONFIRMACAO, textoConfere, tipoPadrao, type TipoConfirmacao } from './confirmacao';

// Ícone de cada tipo: o desenho diz o que a ação faz antes de ler o texto.
const ICONE_CONFIRMACAO: Record<TipoConfirmacao, LucideIcon> = { arquivar: Archive, excluir: Trash2, concluir: CircleCheck, perigo: TriangleAlert, neutro: CircleHelp };

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
  /** Aparência da janela (ícone, anel e botão). Sem ele, a variante decide. */
  tipo?: TipoConfirmacao;
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
  const tipo = props.tipo ?? tipoPadrao(variante);
  const ap = APARENCIA_CONFIRMACAO[tipo];
  const Icone = ICONE_CONFIRMACAO[tipo];
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState('');
  const idDigitar = useId();
  const idEsperado = useId();
  const liberado = !digitarParaConfirmar || textoConfere(digitado, digitarParaConfirmar);

  // Formulário externo: fecha a janela depois que o envio começou (fechar no clique cortaria o submit).
  const externo = 'formulario' in props ? props.formulario : undefined;
  useEffect(() => {
    if (!aberto || !externo) return;
    const form = document.getElementById(externo);
    if (!(form instanceof HTMLFormElement)) {
      console.warn(`[ConfirmDialog] formulário "${externo}" não encontrado: o botão de confirmar não vai enviar nada.`);
      return;
    }
    const aoEnviar = () => setTimeout(() => setAberto(false), 0);
    // Validação do navegador barrou o envio (campo obrigatório atrás da janela): fecha e mostra o aviso no campo.
    let avisando = false;
    const aoInvalidar = () => {
      if (avisando) return;
      avisando = true;
      setAberto(false);
      // Depois da janela fechar e devolver o foco ao gatilho (animação de 100ms).
      setTimeout(() => { form.reportValidity(); avisando = false; }, 150);
    };
    form.addEventListener('submit', aoEnviar);
    form.addEventListener('invalid', aoInvalidar, true);
    return () => {
      form.removeEventListener('submit', aoEnviar);
      form.removeEventListener('invalid', aoInvalidar, true);
    };
  }, [aberto, externo]);

  const mudarAberto = (v: boolean) => {
    setAberto(v);
    if (!v) setDigitado('');
  };

  const campoDigitar = digitarParaConfirmar && (
    <div className="flex flex-col gap-1.5 text-left">
      <Label htmlFor={idDigitar} className="block normal-case font-normal tracking-normal text-muted">Digite o nome para confirmar</Label>
      <span id={idEsperado} className="sr-only">Nome esperado: {digitarParaConfirmar}</span>
      <Input id={idDigitar} aria-describedby={idEsperado} value={digitado} onChange={(e) => setDigitado(e.target.value)} autoComplete="off" spellCheck={false} />
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent className="max-w-md text-center">
        <DialogHeader className="gap-3 pr-0">
          <div aria-hidden className={cn('mx-auto flex size-20 items-center justify-center rounded-full border-4', ap.anel)}>
            <Icone size={40} strokeWidth={1.5} className={ap.icone} />
          </div>
          <DialogTitle className="text-2xl font-light">{titulo}</DialogTitle>
          {descricao ? <DialogDescription className="text-base text-muted">{descricao}</DialogDescription> : <DialogDescription className="sr-only">Confirme a ação.</DialogDescription>}
        </DialogHeader>
        {'acao' in props && props.acao ? (
          <form action={props.acao} className="grid gap-4">
            {props.children}
            {campoDigitar}
            <DialogFooter className="items-center justify-center sm:justify-center">
              <DialogClose asChild><Button type="button" variant="outline" className="rounded-pill px-6">Cancelar</Button></DialogClose>
              <BotaoEnviar rotulo={confirmar} enviando={enviando} variante={ap.botao} liberado={liberado} aoTerminar={() => mudarAberto(false)} />
            </DialogFooter>
          </form>
        ) : (
          <div className="grid gap-4">
            {campoDigitar}
            <DialogFooter className="items-center justify-center sm:justify-center">
              <DialogClose asChild><Button type="button" variant="outline" className="rounded-pill px-6">Cancelar</Button></DialogClose>
              <Button type="submit" form={externo} variant={ap.botao} className="rounded-pill px-6" disabled={!liberado}>{confirmar}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Submit dentro do form: mostra "enviando" e fecha a janela quando a ação termina (erro volta pela página com ?erro=). */
function BotaoEnviar({ rotulo, enviando, variante, liberado, aoTerminar }: { rotulo: string; enviando?: string; variante: 'primary' | 'grafite' | 'success' | 'danger'; liberado: boolean; aoTerminar: () => void }) {
  const { pending } = useFormStatus();
  const antes = useRef(false);
  useEffect(() => {
    if (antes.current && !pending) aoTerminar();
    antes.current = pending;
  }, [pending, aoTerminar]);
  return (
    <Button type="submit" variant={variante} className="rounded-pill px-6" disabled={!liberado || pending} aria-disabled={!liberado || pending}>
      {pending ? enviando ?? `${rotulo}…` : rotulo}
    </Button>
  );
}
