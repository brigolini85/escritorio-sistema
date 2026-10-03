'use client';

import { ListChecks, LockKeyhole, Paperclip, SendHorizontal, Sparkles, StickyNote, X } from 'lucide-react';
import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { EscolherDemanda, rotuloDemanda, type DemandaDaConversa } from './acoes-conversa';
import { demandaEmFoco, useEstadoConversa, type ModoCompositor } from './estado-conversa';
import { SugerirResposta } from './sugerir-resposta';

type Acao = (dados: FormData) => void | Promise<void>;
export type RespostaPronta = { id: string; pergunta: string; resposta: string };

const SEM_DEMANDA = 'A nota interna fica registrada numa demanda, e esta conversa não tem demanda aberta.';
const areaTexto = 'block min-h-16 w-full resize-none bg-transparent px-3 py-2 text-base text-foreground placeholder:text-subtle focus:outline-none disabled:cursor-not-allowed';

/** Enter envia; Shift+Enter quebra a linha (spec 7A.1). Ctrl/⌘+Enter também envia. Durante a composição de acentos, não envia. */
function enviarComAtalho(e: KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
  e.preventDefault();
  e.currentTarget.form?.requestSubmit();
}

/**
 * Compositor da conversa com a alternância Responder ao cliente / Nota interna.
 * Responder: mesma server action de antes (campos `texto` e `arquivo`, botão "Enviar").
 * Nota interna: ação `notaInterna` da demanda em foco (campo `texto`); sem demanda aberta, fica desabilitada.
 * "/" no começo de uma palavra abre as respostas prontas (Configurações), que entram no texto para revisar antes de enviar.
 */
export function Compositor({ responder, demandas, respostas, conversaId, podeSugerir, abrirDemanda }: {
  responder: Acao; demandas: DemandaDaConversa[]; respostas: RespostaPronta[];
  conversaId: string; podeSugerir: boolean;
  /** Botão "Abrir demanda" (já ligado à conversa). */
  abrirDemanda: ReactNode;
}) {
  const { modo, setModo, demandaId } = useEstadoConversa();
  const demanda = demandaEmFoco(demandas, demandaId);
  const semDemanda = !demanda;

  return (
    <div data-compositor="" className="border-t border-border bg-surface p-3">
      <Tabs value={modo} onValueChange={(v) => setModo(v as ModoCompositor)}>
        <TabsList aria-label="Tipo de mensagem" className="h-8">
          <TabsTrigger value="responder" className="h-7">
            <SendHorizontal aria-hidden size={14} strokeWidth={1.75} />
            Responder ao cliente
          </TabsTrigger>
          <TabsTrigger value="nota" className="h-7 data-[state=active]:bg-internal-note data-[state=active]:text-internal-note-foreground" aria-keyshortcuts={semDemanda ? undefined : "N"} title={semDemanda ? SEM_DEMANDA : "Nota interna (atalho N)"}>
            <StickyNote aria-hidden size={14} strokeWidth={1.75} />
            Nota interna
          </TabsTrigger>
        </TabsList>

        <TabsContent value="responder" forceMount className="mt-2 data-[state=inactive]:hidden">
          <FormResposta responder={responder} respostas={respostas} conversaId={conversaId} podeSugerir={podeSugerir} abrirDemanda={abrirDemanda} />
        </TabsContent>
        <TabsContent value="nota" forceMount className="mt-2 data-[state=inactive]:hidden">
          {demanda ? (
            <form action={demanda.nota} className="rounded-md border border-internal-note-border bg-internal-note focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring">
              <div className="flex flex-wrap items-center gap-2 px-3 pt-2 text-xs font-medium text-internal-note-foreground">
                <LockKeyhole aria-hidden size={14} strokeWidth={1.75} />
                <span>Nota interna · o cliente não vê</span>
                {demandas.length > 1 ? (
                  <EscolherDemanda demandas={demandas} className="ml-auto" />
                ) : (
                  // Só o número: o título já aparece em Detalhes (e repetir o texto num campo escondido confunde a busca por texto).
                  <span className="ml-auto truncate font-normal" title={rotuloDemanda(demanda)}>na demanda #{demanda.numero}</span>
                )}
              </div>
              <CampoComRespostas
                name="texto"
                placeholder="Escreva uma nota para a equipe"
                rotulo="Nota interna"
                dataAtalho="nota"
                respostas={respostas}
              />
              <div className="flex items-center justify-end gap-2 px-2 pb-2">
                <span className="mr-auto px-1 text-xs text-internal-note-foreground">Enter salva · Shift+Enter quebra linha</span>
                <BotaoEnviar rotulo="Salvar nota" enviando="Salvando…" />
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted">{SEM_DEMANDA}</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FormResposta({ responder, respostas, conversaId, podeSugerir, abrirDemanda }: {
  responder: Acao; respostas: RespostaPronta[]; conversaId: string; podeSugerir: boolean; abrirDemanda: ReactNode;
}) {
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [deSugestao, setDeSugestao] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const usarSugestao = useCallback(() => setDeSugestao(true), []);
  const entrada = useRef<HTMLInputElement>(null);
  const id = useId();
  return (
    <form action={responder} onReset={() => { setArquivo(null); setDeSugestao(false); }}
      // Campo esvaziado: o texto deixa de ser "a sugestão" e a marca sai.
      // Só digitação dispara onInput: a sugestão entra por código (el.value = ...) e por isso não apaga a marca.
      onInput={(e) => { if (deSugestao && e.target === campo.current && campo.current.value.trim() === '') setDeSugestao(false); }}
      className={cn('rounded-md border bg-surface shadow-sm focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring',
        deSugestao ? 'border-brand' : 'border-input focus-within:border-brand')}>
      {deSugestao && (
        <p className="flex items-center gap-1.5 px-3 pt-2 text-xs font-bold uppercase tracking-wide text-brand">
          <Sparkles aria-hidden size={14} strokeWidth={1.75} /> Sugestão do assistente (editável)
        </p>
      )}
      <CampoComRespostas name="texto" placeholder="Escreva a resposta para o cliente" rotulo="Resposta para o cliente" respostas={respostas} campoRef={campo} />
      <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
        <input
          ref={entrada}
          id={id}
          name="arquivo"
          type="file"
          className="peer sr-only"
          onChange={(e) => setArquivo(e.target.files?.[0]?.name ?? null)}
        />
        <label
          htmlFor={id}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-ring text-sm font-medium text-muted transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground"
        >
          <Paperclip aria-hidden size={16} strokeWidth={1.75} />
          Anexar arquivo
        </label>
        {arquivo && (
          <span className="inline-flex max-w-48 items-center gap-1 rounded-sm bg-surface-muted px-1.5 py-0.5 text-xs text-muted">
            <span className="truncate">{arquivo}</span>
            <button
              type="button"
              aria-label={`Tirar o arquivo ${arquivo}`}
              className="cursor-pointer rounded-sm hover:text-foreground"
              onClick={() => {
                if (entrada.current) entrada.current.value = '';
                setArquivo(null);
              }}
            >
              <X aria-hidden size={14} strokeWidth={1.75} />
            </button>
          </span>
        )}
        {respostas.length > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => {
            const el = campo.current;
            if (!el) return;
            // "/" só abre a lista no começo de uma palavra: com texto sem espaço no fim, entra um espaço antes.
            el.value += (el.value === '' || /\s$/.test(el.value) ? '' : ' ') + '/';
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }}>
            <ListChecks aria-hidden size={16} strokeWidth={1.75} />
            Respostas prontas
          </Button>
        )}
        {podeSugerir && <SugerirResposta conversaId={conversaId} campo={campo} aoUsar={usarSugestao} />}
        {abrirDemanda}
        <span className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-subtle sm:inline">{respostas.length > 0 && '/ respostas prontas · '}Enter envia · Shift+Enter quebra linha</span>
          <BotaoEnviar rotulo="Enviar" enviando="Enviando…" />
        </span>
      </div>
    </form>
  );
}

function BotaoEnviar({ rotulo, enviando }: { rotulo: string; enviando: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? enviando : rotulo}
    </Button>
  );
}

/** Texto antes do cursor terminando em "/palavra" (no começo ou depois de espaço): o que filtrar nas respostas prontas. */
function consultaBarra(texto: string, cursor: number): { inicio: number; termo: string } | null {
  const m = /(^|\s)\/([^\s/]*)$/.exec(texto.slice(0, cursor));
  return m ? { inicio: cursor - m[2]!.length - 1, termo: m[2]! } : null;
}

const normalizar = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Textarea não controlado (o formulário continua enviando `name` como antes) com a lista de respostas prontas. */
function CampoComRespostas({
  name,
  placeholder,
  rotulo,
  dataAtalho,
  respostas,
  campoRef,
}: {
  name: string;
  placeholder: string;
  rotulo: string;
  dataAtalho?: string;
  respostas: RespostaPronta[];
  campoRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const refInterno = useRef<HTMLTextAreaElement>(null);
  const ref = campoRef ?? refInterno;
  const idLista = useId();
  const [busca, setBusca] = useState<{ inicio: number; termo: string } | null>(null);
  const [ativo, setAtivo] = useState(0);

  const opcoes = busca
    ? respostas.filter((r) => {
      const t = normalizar(busca.termo);
      return !t || normalizar(r.pergunta).includes(t) || normalizar(r.resposta).includes(t);
    }).slice(0, 8)
    : [];
  const aberta = Boolean(busca) && respostas.length > 0;

  const atualizar = () => {
    const el = ref.current;
    if (!el || respostas.length === 0) return;
    const b = consultaBarra(el.value, el.selectionStart ?? el.value.length);
    setBusca(b);
    setAtivo(0);
  };

  const inserir = (r: RespostaPronta) => {
    const el = ref.current;
    if (!el || !busca) return;
    const cursor = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, busca.inicio) + r.resposta + el.value.slice(cursor);
    const fim = busca.inicio + r.resposta.length;
    el.setSelectionRange(fim, fim);
    el.focus();
    setBusca(null);
  };

  return (
    <div className="relative">
      <label htmlFor={`${idLista}-campo`} className="sr-only">{rotulo}</label>
      <textarea
        ref={ref}
        id={`${idLista}-campo`}
        name={name}
        rows={2}
        placeholder={placeholder}
        data-atalho={dataAtalho}
        className={areaTexto}
        aria-autocomplete={respostas.length ? 'list' : undefined}
        aria-controls={aberta && opcoes.length ? idLista : undefined}
        aria-activedescendant={aberta && opcoes[ativo] ? `${idLista}-${ativo}` : undefined}
        onInput={atualizar}
        onClick={atualizar}
        onBlur={() => setTimeout(() => setBusca(null), 150)}
        onKeyDown={(e) => {
          if (aberta) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              if (opcoes.length) setAtivo((a) => (a + (e.key === 'ArrowDown' ? 1 : opcoes.length - 1)) % opcoes.length);
              return;
            }
            if ((e.key === 'Enter' || e.key === 'Tab') && opcoes[ativo] && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              inserir(opcoes[ativo]!);
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setBusca(null);
              return;
            }
          }
          enviarComAtalho(e);
        }}
      />
      {aberta && (
        <div className="absolute inset-x-2 bottom-full z-20 mb-1 overflow-hidden rounded-lg border border-border bg-surface shadow-md">
          <p className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted">Respostas prontas</p>
          {opcoes.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">Nenhuma resposta pronta com “{busca?.termo}”.</p>
          ) : (
            <ul id={idLista} role="listbox" aria-label="Respostas prontas" className="max-h-56 overflow-y-auto py-1">
              {opcoes.map((r, i) => (
                <li
                  key={r.id}
                  id={`${idLista}-${i}`}
                  role="option"
                  aria-selected={i === ativo}
                  className={cn('cursor-pointer px-3 py-1.5', i === ativo ? 'bg-brand-soft' : 'hover:bg-surface-muted')}
                  onMouseDown={(e) => { e.preventDefault(); inserir(r); }}
                  onMouseEnter={() => setAtivo(i)}
                >
                  <span className="block truncate text-sm font-medium text-foreground">{r.pergunta}</span>
                  <span className="block truncate text-xs text-muted">{r.resposta}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
