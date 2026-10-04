'use client';
import { LoaderCircle, SendHorizontal } from 'lucide-react';
import { createContext, useContext, useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { LIMITE_PERGUNTA, tamanhoEnviado } from '@/lib/texto-assistente';

type Acao = (dados: FormData) => void | Promise<void>;

/** Liga as sugestões do estado vazio ao campo de pergunta (a sugestão entra no campo para a pessoa revisar). */
const Contexto = createContext<RefObject<HTMLTextAreaElement | null> | null>(null);

export function ProvedorAssistente({ children }: { children: ReactNode }) {
  const campo = useRef<HTMLTextAreaElement>(null);
  return <Contexto.Provider value={campo}>{children}</Contexto.Provider>;
}

/** Campo da pergunta da tela (as sugestões e o "Mudar outra coisa" escrevem nele). */
export function usarCampoPergunta() {
  return useContext(Contexto);
}

/** Põe o texto no campo para a pessoa revisar: não envia. */
export function preencherCampo(el: HTMLTextAreaElement, texto: string) {
  el.value = texto;
  conferirTamanho(el);
  el.focus();
  el.setSelectionRange(texto.length, texto.length);
}

/** Perguntas de exemplo no estado vazio: um clique põe o texto no campo (não envia sozinho). */
export function Sugestoes({ itens, className }: { itens: string[]; className?: string }) {
  const campo = useContext(Contexto);
  return (
    <ul aria-label="Sugestões de perguntas" className={cn('flex flex-wrap justify-center gap-2', className)}>
      {itens.map((s) => (
        <li key={s}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-8 whitespace-normal py-1 text-left"
            onClick={() => {
              const el = campo?.current;
              if (el) preencherCampo(el, s);
            }}
          >
            {s}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * O navegador avisa no campo antes de enviar, em vez de a pergunta voltar com erro:
 * - só espaços ou quebras de linha passam pelo `required`, mas o servidor recusa a pergunta vazia ("Escreva a pergunta");
 * - o maxlength conta a quebra de linha como 1, mas o navegador a envia como "\r\n" (2), e o servidor recusa acima de 4000.
 */
function conferirTamanho(el: HTMLTextAreaElement) {
  el.setCustomValidity(el.value !== '' && el.value.trim() === ''
    ? 'Escreva a pergunta (só espaços não contam).'
    : tamanhoEnviado(el.value) > LIMITE_PERGUNTA
      ? `A pergunta passou de ${LIMITE_PERGUNTA} caracteres (cada quebra de linha conta como 2). Encurte um pouco.`
      : '');
}

/**
 * Campo da pergunta (mesmo formulário de antes: campo `pergunta`, até 4000 caracteres, botão "Enviar").
 * Enter envia; Shift+Enter quebra a linha. Enquanto a pergunta vai para o servidor, um novo envio é ignorado
 * (nem Enter nem o botão gravam a mesma pergunta duas vezes).
 */
export function CompositorAssistente({ acao, compacta = false }: { acao: Acao; compacta?: boolean }) {
  const enviando = useRef(false);
  return (
    <form
      action={acao}
      data-compositor-assistente=""
      onSubmit={(e) => {
        // O submit só chega aqui com o formulário válido; outro, antes de a ação terminar, é barrado.
        if (enviando.current) e.preventDefault();
        else enviando.current = true;
      }}
      className="relative flex flex-col gap-2 rounded-lg border border-input bg-surface p-2 shadow-sm focus-within:outline-2 focus-within:outline-ring"
    >
      <CamposPergunta compacta={compacta} enviando={enviando} />
    </form>
  );
}

function CamposPergunta({ compacta, enviando }: { compacta: boolean; enviando: RefObject<boolean> }) {
  const campo = useContext(Contexto);
  const dica = useId();
  const { pending } = useFormStatus();
  // A ação terminou (com sucesso ou com ?erro=): libera o próximo envio.
  useEffect(() => {
    if (!pending) enviando.current = false;
  }, [pending, enviando]);

  return (
    <>
      <label className="sr-only" htmlFor={`${dica}-campo`}>Pergunta ao assistente</label>
      <textarea
        ref={campo}
        id={`${dica}-campo`}
        name="pergunta"
        placeholder="Pergunte ao assistente"
        required
        maxLength={LIMITE_PERGUNTA}
        rows={1}
        autoComplete="off"
        aria-describedby={dica}
        className={cn(
          'field-sizing-content block max-h-40 min-h-10 w-full resize-none bg-transparent px-2 py-1.5 text-base text-foreground placeholder:text-subtle focus:outline-none',
          compacta && 'text-sm',
        )}
        onInput={(e) => conferirTamanho(e.currentTarget)}
        onKeyDown={(e) => {
          // keyCode 229: o Safari confirma a composição (acento, IME) com um Enter sem isComposing.
          const compondo = e.nativeEvent.isComposing || e.keyCode === 229;
          if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || compondo) return;
          e.preventDefault();
          if (pending || enviando.current) return;
          conferirTamanho(e.currentTarget);
          e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="flex items-center gap-2">
        <p id={dica} className={cn('text-xs text-subtle', compacta && 'sr-only')}>Enter envia · Shift+Enter quebra a linha</p>
        <BotaoEnviar />
      </div>
    </>
  );
}

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending || undefined} className="ml-auto">
      {pending
        ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" />
        : <SendHorizontal aria-hidden size={16} strokeWidth={1.75} />}
      Enviar
    </Button>
  );
}
