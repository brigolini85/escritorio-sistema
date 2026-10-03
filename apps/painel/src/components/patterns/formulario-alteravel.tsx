'use client';

import { LoaderCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

/** Formulários alteráveis montados na página: um único par de ouvintes cuida de todos (uma pergunta só). */
const montados = new Set<HTMLFormElement>();
const algumAlterado = () => [...montados].some((f) => f.isConnected && formularioAlterado(f));
const PERGUNTA_SAIR = 'Há alterações não salvas nesta página. Sair sem salvar?';

/** Fechar ou recarregar a aba: o navegador pergunta (returnValue para Chrome antigo e WebViews). */
function aoDescarregar(e: BeforeUnloadEvent) {
  if (!algumAlterado()) return;
  e.preventDefault();
  e.returnValue = '';
}

/**
 * Link para outra página do painel (menu, trilha, busca): a navegação do Next não dispara o beforeunload, então
 * o clique é conferido antes (fase de captura no document, antes do Link) e só segue se a pessoa confirmar.
 */
function aoClicarLink(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = (e.target as Element | null)?.closest?.('a[href]');
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download')) return;
  // Outra janela ou moldura (qualquer target que não seja _self): esta página continua aberta.
  const alvo = link.target.trim().toLowerCase();
  if (alvo && alvo !== '_self') return;
  const destino = new URL(link.href, window.location.href);
  const aqui = new URL(window.location.href);
  // Só links do próprio painel (http/https, mesma origem): outro site descarrega a página e cai no beforeunload;
  // mailto:, tel: e afins não saem da página.
  if ((destino.protocol !== 'http:' && destino.protocol !== 'https:') || destino.origin !== aqui.origin) return;
  // Âncora na mesma página (navegação interna de Configurações): nada se perde.
  if (destino.pathname === aqui.pathname && destino.search === aqui.search) return;
  if (!algumAlterado()) return;
  if (!window.confirm(PERGUNTA_SAIR)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function registrar(f: HTMLFormElement): () => void {
  if (montados.size === 0) {
    window.addEventListener('beforeunload', aoDescarregar);
    document.addEventListener('click', aoClicarLink, true);
  }
  montados.add(f);
  return () => {
    montados.delete(f);
    if (montados.size === 0) {
      window.removeEventListener('beforeunload', aoDescarregar);
      document.removeEventListener('click', aoClicarLink, true);
    }
  };
}

/**
 * Fechar um painel lateral ou uma janela com formulário alterado dentro: pergunta antes de descartar.
 * `tentarFechar(elemento, fechar)` fecha na hora se nada mudou; senão abre a confirmação (`janela`, que precisa
 * ser renderizada pelo componente).
 */
export function useDescarteProtegido() {
  const [pendente, setPendente] = useState<(() => void) | null>(null);
  const tentarFechar = useCallback((conteudo: Element | null, fechar: () => void) => {
    const forms = conteudo ? [...conteudo.querySelectorAll('form')] : [];
    if (forms.some((f) => formularioAlterado(f))) setPendente(() => fechar);
    else fechar();
  }, []);
  const janela = (
    <Dialog open={pendente !== null} onOpenChange={(v) => { if (!v) setPendente(null); }}>
      <DialogContent mostrarFechar={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Descartar as alterações?</DialogTitle>
          <DialogDescription>O que você mudou ainda não foi salvo.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Continuar editando</Button></DialogClose>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              const fechar = pendente;
              setPendente(null);
              fechar?.();
            }}
          >
            Descartar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { tentarFechar, janela };
}

/**
 * <form action={serverAction}> que sabe se tem alteração não salva, comparando cada campo nativo com o valor que
 * veio do servidor (defaultValue/defaultChecked/defaultSelected). Não muda nada do que é enviado. Depois de salvar,
 * a página volta com os valores novos como padrão e o indicador some sozinho. Fechar ou recarregar a aba, ou
 * seguir um link para outra página do painel, com alteração pede confirmação. Use com <IndicadorAlteracoes /> e <BotaoSalvar /> dentro.
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
    const f = form.current;
    if (!f) return;
    return registrar(f);
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
export function BotaoSalvar({ children, destacar = false, enviando = false, className, ...props }: Omit<ButtonProps, 'type' | 'variant'> & {
  destacar?: boolean;
  /** Formulário enviado à mão (onSubmit + transição): o useFormStatus não sabe que está salvando. */
  enviando?: boolean;
}) {
  const ancora = useRef<HTMLButtonElement>(null);
  const alterado = useAlterado(ancora);
  const pending = useFormStatus().pending || enviando;
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
