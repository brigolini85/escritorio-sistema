'use client';
import { LoaderCircle, SendHorizontal } from 'lucide-react';
import { createContext, useContext, useId, useRef, type ReactNode, type RefObject } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type Acao = (dados: FormData) => void | Promise<void>;

/** Liga as sugestões do estado vazio ao campo de pergunta (a sugestão entra no campo para a pessoa revisar). */
const Contexto = createContext<RefObject<HTMLTextAreaElement | null> | null>(null);

export function ProvedorAssistente({ children }: { children: ReactNode }) {
  const campo = useRef<HTMLTextAreaElement>(null);
  return <Contexto.Provider value={campo}>{children}</Contexto.Provider>;
}

/** Perguntas de exemplo no estado vazio: um clique põe o texto no campo (não envia sozinho). */
export function Sugestoes({ itens }: { itens: string[] }) {
  const campo = useContext(Contexto);
  return (
    <ul aria-label="Sugestões de perguntas" className="flex flex-wrap justify-center gap-2">
      {itens.map((s) => (
        <li key={s}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-8 whitespace-normal py-1 text-left"
            onClick={() => {
              const el = campo?.current;
              if (!el) return;
              el.value = s;
              el.focus();
              el.setSelectionRange(s.length, s.length);
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
 * Campo da pergunta (mesmo formulário de antes: campo `pergunta`, até 4000 caracteres, botão "Enviar").
 * Enter envia; Shift+Enter quebra a linha.
 */
export function CompositorAssistente({ acao, compacta = false }: { acao: Acao; compacta?: boolean }) {
  const campo = useContext(Contexto);
  const dica = useId();
  return (
    <form
      action={acao}
      data-compositor-assistente=""
      className="relative flex flex-col gap-2 rounded-lg border border-input bg-surface p-2 shadow-sm focus-within:outline-2 focus-within:outline-ring"
    >
      <label className="sr-only" htmlFor={`${dica}-campo`}>Pergunta ao assistente</label>
      <textarea
        ref={campo}
        id={`${dica}-campo`}
        name="pergunta"
        placeholder="Pergunte ao assistente"
        required
        maxLength={4000}
        rows={1}
        autoComplete="off"
        aria-describedby={dica}
        className={cn(
          'field-sizing-content block max-h-40 min-h-10 w-full resize-none bg-transparent px-2 py-1.5 text-base text-foreground placeholder:text-subtle focus:outline-none',
          compacta && 'text-sm',
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <p id={dica} className={cn('text-xs text-subtle', compacta && 'sr-only')}>Enter envia · Shift+Enter quebra a linha</p>
        <BotaoEnviar />
      </div>
    </form>
  );
}

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending || undefined}>
      {pending
        ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" />
        : <SendHorizontal aria-hidden size={16} strokeWidth={1.75} />}
      Enviar
    </Button>
  );
}
