'use client';

import { LoaderCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type Contexto = { form: RefObject<HTMLFormElement | null>; versao: number };
const ContextoFormulario = createContext<Contexto | null>(null);

/** Atributo que marca um pedaço do formulário (ex.: um card) como escopo do indicador que estiver dentro dele.
 * Em server component, escreva o atributo direto (data-escopo-alteracoes=""): esta constante vive num módulo client. */
const ESCOPO_ALTERACOES = 'data-escopo-alteracoes';

/**
 * Nos Switch/Checkbox do Radix, o valor inicial vai neste atributo: <Switch {...inicialRadix(marcado)} />.
 * A caixa escondida que eles criam para o formulário acompanha o estado atual e não serve para comparar.
 */
const ATRIBUTO_INICIAL = 'data-inicial';
export function inicialRadix(marcado: boolean | undefined) {
  return { [ATRIBUTO_INICIAL]: String(Boolean(marcado)) };
}

/** O campo está diferente do valor com que a página veio (o padrão que o servidor mandou)? */
function campoAlterado(el: Element): boolean {
  // Switch/Checkbox do Radix (botão com aria-checked): compara com o estado inicial guardado em data-inicial.
  if (el instanceof HTMLButtonElement) {
    const inicial = el.getAttribute(ATRIBUTO_INICIAL);
    return inicial !== null && el.getAttribute('aria-checked') !== inicial;
  }
  if (el instanceof HTMLInputElement) {
    if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(el.type)) return false;
    // Caixa escondida dos componentes Radix (Switch/Checkbox): o estado vale pelo botão visível, não por ela.
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked !== el.defaultChecked;
    return el.value !== el.defaultValue;
  }
  if (el instanceof HTMLTextAreaElement) return el.value !== el.defaultValue;
  if (el instanceof HTMLSelectElement) {
    const opcoes = [...el.options];
    // Sem opção marcada como padrão, o navegador começa na primeira (ou em nenhuma, no múltiplo).
    if (!opcoes.some((o) => o.defaultSelected)) return el.multiple ? opcoes.some((o) => o.selected) : el.selectedIndex > 0;
    return opcoes.some((o) => o.selected !== o.defaultSelected);
  }
  return false;
}

/** Algum campo do formulário (dentro de `escopo`, se dado) mudou e ainda não foi salvo? */
export function formularioAlterado(form: HTMLFormElement, escopo?: Element | null): boolean {
  return [...form.elements].some((el) => (!escopo || escopo.contains(el)) && campoAlterado(el));
}

/**
 * <form action={serverAction}> que sabe se tem alteração não salva, comparando cada campo nativo com o valor que
 * veio do servidor (defaultValue/defaultChecked/defaultSelected). Não muda nada do que é enviado. Depois de salvar,
 * a página volta com os valores novos como padrão e o indicador some sozinho. Fechar ou recarregar a aba com
 * alteração pede confirmação ao navegador. Use com <IndicadorAlteracoes /> e <BotaoSalvar /> dentro.
 */
export function FormularioAlteravel({ className, children, onInput, onChange, onClick, onReset, ...props }: ComponentProps<'form'>) {
  const form = useRef<HTMLFormElement>(null);
  const [versao, setVersao] = useState(0);
  const conferir = useCallback(() => setVersao((v) => v + 1), []);

  // Os valores padrão mudam quando a página volta do servidor (render novo): confere de novo.
  useLayoutEffect(() => {
    conferir();
  }, [children, conferir]);

  useEffect(() => {
    const aoSair = (e: BeforeUnloadEvent) => {
      if (form.current && formularioAlterado(form.current)) e.preventDefault();
    };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, []);

  return (
    <ContextoFormulario.Provider value={{ form, versao }}>
      <form
        ref={form}
        className={className}
        onInput={(e) => { conferir(); onInput?.(e); }}
        onChange={(e) => { conferir(); onChange?.(e); }}
        // Switch/Checkbox do Radix mudam o aria-checked no clique.
        onClick={(e) => { setTimeout(conferir, 0); onClick?.(e); }}
        // O React 19 limpa o formulário depois da ação; confere no quadro seguinte, já com os valores novos.
        onReset={(e) => { setTimeout(conferir, 0); onReset?.(e); }}
        {...props}
      >
        {children}
      </form>
    </ContextoFormulario.Provider>
  );
}

/** true quando os campos do formulário (ou só os do escopo onde `ancora` está) têm alteração não salva. */
function useAlterado(ancora: RefObject<Element | null>): boolean {
  const ctx = useContext(ContextoFormulario);
  const [alterado, setAlterado] = useState(false);
  const versao = ctx?.versao;
  const form = ctx?.form;
  useEffect(() => {
    const f = form?.current;
    const escopo = ancora.current?.closest(`[${ESCOPO_ALTERACOES}]`) ?? null;
    setAlterado(Boolean(f && formularioAlterado(f, escopo && f.contains(escopo) ? escopo : null)));
  }, [versao, form, ancora]);
  return alterado;
}

/**
 * "Alterações não salvas" (ponto amarelo + texto) quando algum campo mudou. Dentro de um elemento com
 * `data-escopo-alteracoes`, só os campos desse elemento contam (ex.: um card de um formulário que ocupa dois cards).
 * `compacto`: só "Não salvo" (linhas de uma lista).
 */
export function IndicadorAlteracoes({ compacto = false, className }: { compacto?: boolean; className?: string }) {
  const ancora = useRef<HTMLSpanElement>(null);
  const alterado = useAlterado(ancora);
  return (
    <span ref={ancora} role="status" className={cn('inline-flex items-center gap-1.5 text-sm text-warning', compacto && 'text-xs', !alterado && 'sr-only', className)}>
      {alterado && (
        <>
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
          {compacto ? 'Não salvo' : 'Alterações não salvas'}
        </>
      )}
    </span>
  );
}

/**
 * Botão de enviar do FormularioAlteravel. O texto não muda (testes e leitor de tela acham pelo nome); enquanto
 * salva, fica desabilitado com um ícone girando. `destacar`: "outline" sem alteração e "primary" com alteração.
 */
export function BotaoSalvar({ children, destacar = false, className, ...props }: Omit<ButtonProps, 'type' | 'variant'> & { destacar?: boolean }) {
  const ancora = useRef<HTMLButtonElement>(null);
  const alterado = useAlterado(ancora);
  const { pending } = useFormStatus();
  return (
    <Button
      ref={ancora}
      type="submit"
      variant={destacar && !alterado ? 'outline' : 'primary'}
      disabled={pending}
      aria-busy={pending || undefined}
      className={className}
      {...props}
    >
      {pending && <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" />}
      {children}
    </Button>
  );
}
