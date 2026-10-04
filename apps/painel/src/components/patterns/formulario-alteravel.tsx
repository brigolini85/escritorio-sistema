'use client';

import { LoaderCircle, Pencil } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';

type Contexto = { form: RefObject<HTMLFormElement | null>; versao: number; conferir: () => void };
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

/** Algum formulário montado mudou de estado: o menu de Configurações mostra "não salvo". */
const EVENTO_ALTERADOS = 'formularios-alterados';
const avisarMudanca = () => window.dispatchEvent(new Event(EVENTO_ALTERADOS));

type Montado = { salvarParaSair: () => Promise<boolean> };
/** Formulários alteráveis montados na página: um único par de ouvintes cuida de todos (uma pergunta só). */
const montados = new Map<HTMLFormElement, Montado>();
const algumAlterado = () => [...montados.keys()].some((f) => f.isConnected && formularioAlterado(f));

/** Quantos campos (pelo nome) mudaram: as caixas "dia" do expediente contam como uma alteração. */
export function contarAlteracoes(form: HTMLFormElement, escopo?: Element | null): number {
  const nomes = new Set<string>();
  [...form.elements].forEach((el, i) => {
    if ((!escopo || escopo.contains(el)) && campoAlterado(el)) nomes.add((el as HTMLInputElement).name || el.id || `#${i}`);
  });
  return nomes.size;
}

/** Volta os campos (do escopo, se dado) ao valor que veio do servidor e avisa o formulário. Switch do Radix volta com um clique. */
export function restaurarCampos(form: HTMLFormElement, escopo?: Element | null) {
  const chaves: HTMLButtonElement[] = [];
  for (const el of form.elements) {
    if (escopo && !escopo.contains(el)) continue;
    if (el instanceof HTMLButtonElement) {
      // O estado do Switch/Checkbox do Radix é do React: só o clique o devolve (depois do laço, que o clique pode mexer nos campos).
      if (campoAlterado(el)) chaves.push(el);
    } else if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = el.defaultChecked;
      else if (!['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(el.type)) el.value = el.defaultValue;
      el.setCustomValidity('');
    } else if (el instanceof HTMLTextAreaElement) {
      el.value = el.defaultValue;
    } else if (el instanceof HTMLSelectElement) {
      for (const o of el.options) o.selected = o.defaultSelected;
      if (!el.multiple && ![...el.options].some((o) => o.defaultSelected) && el.options.length > 0) el.selectedIndex = 0;
    }
  }
  for (const b of chaves) b.click();
  form.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Salvou sem recarregar (FormularioConfig): o que está na tela vira o "valor salvo" de cada campo. O React 19 atualiza
 * defaultValue/defaultChecked no próximo render, mas não o defaultSelected das opções de um <select>: sem isto, o select
 * continuaria âmbar, contando como alteração e voltando a um valor que já não é o salvo.
 */
export function fixarComoSalvo(form: HTMLFormElement) {
  for (const el of form.elements) {
    if (el instanceof HTMLButtonElement) {
      if (el.getAttribute(ATRIBUTO_INICIAL) !== null) el.setAttribute(ATRIBUTO_INICIAL, el.getAttribute('aria-checked') === 'true' ? 'true' : 'false');
    } else if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') el.defaultChecked = el.checked;
      else if (!['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(el.type)) el.defaultValue = el.value;
    } else if (el instanceof HTMLTextAreaElement) {
      el.defaultValue = el.value;
    } else if (el instanceof HTMLSelectElement) {
      for (const o of el.options) o.defaultSelected = o.selected;
    }
  }
  form.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Janela própria para sair com alteração (Configurações, D14). Sem ela, vale o confirm do navegador de sempre. */
type GuardaSaida = (destino: string) => void;
let guarda: GuardaSaida | null = null;
export function definirGuardaSaida(g: GuardaSaida | null) {
  guarda = g;
}

/** Soma das alterações de todos os formulários montados (texto da janela de saída). */
export const totalDeAlteracoes = () => [...montados.keys()].filter((f) => f.isConnected).reduce((n, f) => n + contarAlteracoes(f), 0);

/** "Salvar e sair": salva, um por vez, cada formulário alterado; para no primeiro que não salvar. */
export async function salvarAlteradosParaSair(): Promise<boolean> {
  for (const [f, m] of montados) {
    if (!f.isConnected || !formularioAlterado(f)) continue;
    if (!(await m.salvarParaSair())) return false;
  }
  return true;
}

/** "Descartar" da janela de saída: tudo volta ao valor salvo. */
export function descartarAlterados() {
  for (const f of montados.keys()) if (f.isConnected && formularioAlterado(f)) restaurarCampos(f);
  avisarMudanca();
}

/** O menu acompanha se há alteração pendente na página. */
export function useAlgumAlterado(): boolean {
  const [alterado, setAlterado] = useState(false);
  useEffect(() => {
    const ver = () => setAlterado(algumAlterado());
    ver();
    window.addEventListener(EVENTO_ALTERADOS, ver);
    return () => window.removeEventListener(EVENTO_ALTERADOS, ver);
  }, []);
  return alterado;
}

/** Ação do servidor chamada direto (sem o <form>): falha se lançar ou devolver { ok: false }. */
async function salvarPelaAction(f: HTMLFormElement, action: (d: FormData) => unknown): Promise<boolean> {
  if (!f.reportValidity()) return false;
  try {
    const r = await action(new FormData(f));
    return !(r && typeof r === 'object' && 'ok' in r && (r as { ok: unknown }).ok === false);
  } catch {
    return false;
  }
}

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
  if (guarda) {
    e.preventDefault();
    e.stopPropagation();
    guarda(`${destino.pathname}${destino.search}${destino.hash}`);
    return;
  }
  if (!window.confirm(PERGUNTA_SAIR)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function registrar(f: HTMLFormElement, m: Montado): () => void {
  if (montados.size === 0) {
    window.addEventListener('beforeunload', aoDescarregar);
    document.addEventListener('click', aoClicarLink, true);
  }
  montados.set(f, m);
  return () => {
    montados.delete(f);
    if (montados.size === 0) {
      window.removeEventListener('beforeunload', aoDescarregar);
      document.removeEventListener('click', aoClicarLink, true);
    }
    avisarMudanca();
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
export function FormularioAlteravel({
  className, children, onInput, onChange, onClick, onReset, marcarAlterados = false, salvarParaSair, ...props
}: ComponentProps<'form'> & {
  /** Campo alterado ganha data-alterado (âmbar pelo CSS global; Configurações). */
  marcarAlterados?: boolean;
  /** Como salvar este formulário pela janela "Salvar e sair". Sem ele, chama a action, se for função. */
  salvarParaSair?: (form: HTMLFormElement) => Promise<boolean>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [versao, setVersao] = useState(0);
  const conferir = useCallback(() => setVersao((v) => v + 1), []);
  const salvar = useRef<(f: HTMLFormElement) => Promise<boolean>>(async () => false);
  const action = props.action;
  useLayoutEffect(() => {
    salvar.current = salvarParaSair ?? (typeof action === 'function' ? (f) => salvarPelaAction(f, action) : async () => false);
  });

  // Os valores padrão mudam quando a página volta do servidor (render novo): confere de novo.
  useLayoutEffect(() => {
    conferir();
  }, [children, conferir]);

  useEffect(() => {
    const f = form.current;
    if (!f) return;
    return registrar(f, { salvarParaSair: () => salvar.current(f) });
  }, []);

  // Marca os campos alterados (âmbar) e avisa quem acompanha (menu "não salvo").
  useEffect(() => {
    const f = form.current;
    if (!f) return;
    if (marcarAlterados) for (const el of f.elements) el.toggleAttribute('data-alterado', campoAlterado(el));
    avisarMudanca();
  }, [versao, marcarAlterados]);

  return (
    <ContextoFormulario.Provider value={{ form, versao, conferir }}>
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

/** Quantos campos do formulário (ou só do escopo onde `ancora` está) têm alteração não salva. */
function useContagem(ancora: RefObject<Element | null>): number {
  const ctx = useContext(ContextoFormulario);
  const [n, setN] = useState(0);
  const versao = ctx?.versao;
  const form = ctx?.form;
  useEffect(() => {
    const f = form?.current;
    const escopo = ancora.current?.closest(`[${ESCOPO_ALTERACOES}]`) ?? null;
    setN(f ? contarAlteracoes(f, escopo && f.contains(escopo) ? escopo : null) : 0);
  }, [versao, form, ancora]);
  return n;
}

/** Quantos campos do formulário em volta (inteiro, sem escopo) têm alteração não salva: para quem mostra o próprio aviso ou desliga um botão. */
export function useAlteracoes(): number {
  const ancora = useRef<Element | null>(null);
  return useContagem(ancora);
}

/**
 * "Alterações não salvas" (ponto amarelo + texto) quando algum campo mudou. Dentro de um elemento com
 * `data-escopo-alteracoes`, só os campos desse elemento contam (ex.: um card de um formulário que ocupa dois cards).
 * `compacto`: só "Não salvo" (linhas de uma lista).
 * `contar` (Configurações): "1 alteração não salva" / "N alterações não salvas" num selo, e "Sem alterações" quando nada mudou.
 */
export function IndicadorAlteracoes({ compacto = false, contar = false, className }: { compacto?: boolean; contar?: boolean; className?: string }) {
  const ancora = useRef<HTMLSpanElement>(null);
  const n = useContagem(ancora);
  const alterado = n > 0;
  if (contar) {
    return (
      <span ref={ancora} role="status" className={cn('inline-flex items-center gap-1.5 text-sm', alterado ? 'rounded-md bg-warning-soft px-3 py-1.5 font-semibold text-warning' : 'text-muted', className)}>
        {alterado && <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />}
        {alterado ? (n === 1 ? '1 alteração não salva' : `${n} alterações não salvas`) : 'Sem alterações'}
      </span>
    );
  }
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
  const alterado = useContagem(ancora) > 0;
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

/** "antes: X" embaixo de um campo alterado (Configurações, spec 7C.4). `texto`: o valor salvo, já escrito como a pessoa lê. */
export function Antes({ campo, texto, className }: { campo: string; texto: string; className?: string }) {
  const ctx = useContext(ContextoFormulario);
  const [mostrar, setMostrar] = useState(false);
  const versao = ctx?.versao;
  const form = ctx?.form;
  useEffect(() => {
    const f = form?.current;
    setMostrar(Boolean(f && [...f.elements].some((el) => (el as HTMLInputElement).name === campo && campoAlterado(el))));
  }, [versao, form, campo]);
  if (!mostrar) return null;
  return (
    <p className={cn('mt-1 flex items-center gap-1 text-xs font-bold text-warning', className)}>
      <Pencil aria-hidden size={12} strokeWidth={2} />
      antes: {texto}
    </p>
  );
}

/** Volta os campos do cartão (ou do escopo) ao valor salvo. Desabilitado quando nada mudou. */
export function BotaoDescartar({ children = 'Descartar', className, ...props }: Omit<ButtonProps, 'type' | 'onClick' | 'variant'>) {
  const ancora = useRef<HTMLButtonElement>(null);
  const n = useContagem(ancora);
  const ctx = useContext(ContextoFormulario);
  return (
    <Button
      ref={ancora}
      type="button"
      variant="outline"
      disabled={n === 0}
      className={className}
      {...props}
      onClick={() => {
        const f = ctx?.form.current;
        if (!f) return;
        const escopo = ancora.current?.closest(`[${ESCOPO_ALTERACOES}]`) ?? null;
        restaurarCampos(f, escopo && f.contains(escopo) ? escopo : null);
        ctx?.conferir();
      }}
    >
      {children}
    </Button>
  );
}

/** Valor atual de um campo do formulário, acompanhando digitação e Descartar (ex.: exemplo de vencimento em Prazos). */
export function useCampoDoFormulario(nome: string, inicial: string): string {
  const ctx = useContext(ContextoFormulario);
  const [valor, setValor] = useState(inicial);
  const versao = ctx?.versao;
  const form = ctx?.form;
  useEffect(() => {
    const el = form?.current?.elements.namedItem(nome);
    if (el && 'value' in el) setValor(String(el.value));
  }, [versao, form, nome]);
  return valor;
}
