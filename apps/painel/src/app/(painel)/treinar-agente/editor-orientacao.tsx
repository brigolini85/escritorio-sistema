'use client';

import { LoaderCircle, Power, Save } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { EscolherEmpresa, type EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { FormField } from '@/components/patterns/form-field';
import { FormularioAlteravel, useAlteracoes } from '@/components/patterns/formulario-alteravel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { LIMITE_TEXTO, LIMITE_TITULO, ROTULO_TIPO, TIPOS, type TipoOrientacao } from '@/lib/orientacoes';
import { classeSelect } from '../clientes/estilos';
import type { ValePara } from './esquemas';
import { DESCRICAO_TIPO } from './opcoes';
import { avisarRascunho, ID_FORM_ORIENTACAO } from './rascunho-ao-vivo';
import { ROTULO_CURTO_TIPO } from './tela';

type Acao = (dados: FormData) => void | Promise<void>;
export type SetorOpcao = { id: string; nome: string; ativo: boolean };
export type DadosFormulario = { titulo: string; texto: string; tipo: TipoOrientacao; clienteId: string | null; setorId: string | null };

type PropsEditor = {
  acao: Acao;
  orientacao?: DadosFormulario;
  empresas: EmpresaOpcao[];
  setores: SetorOpcao[];
  aviso?: ReactNode;
  /** A lista de empresas veio incompleta (aviso discreto no campo). */
  avisoEmpresas?: string | null;
};

const ROTULO = 'text-sm font-semibold uppercase tracking-wide text-brand';
// Botões segmentados (imagem B): o rádio fica escondido e o rótulo inteiro é o alvo do clique.
const SEGMENTO = 'flex flex-1 cursor-pointer items-center justify-center border-l border-input px-3 py-2 text-sm font-semibold text-foreground first:border-l-0 has-checked:bg-brand has-checked:text-brand-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring';
// Rótulo curto na tela, nome completo para leitor de tela (D20).
const VALE: { valor: ValePara; antes: string; visivel: string; depois: string }[] = [
  { valor: 'todos', antes: '', visivel: 'Todos', depois: ' os clientes' },
  { valor: 'empresa', antes: 'Uma ', visivel: 'Empresa', depois: '' },
  { valor: 'setor', antes: 'Um ', visivel: 'Setor', depois: '' },
];

/** "Rascunho não salvo — o simulador já usa este texto" quando algum campo mudou. */
function AvisoRascunho() {
  const n = useAlteracoes();
  return (
    <p role="status" className="flex items-center gap-1.5 text-warning">
      {n > 0 && (
        <>
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
          Rascunho não salvo — o simulador já usa este texto
        </>
      )}
    </p>
  );
}

function BotaoDescartar({ aoDescartar }: { aoDescartar: () => void }) {
  const n = useAlteracoes();
  const { pending } = useFormStatus();
  return <Button type="button" variant="outline" disabled={n === 0 || pending} onClick={aoDescartar}>Descartar</Button>;
}

/** Os dois envios: o botão leva ativo=off|on (D12). Enquanto grava, os dois ficam desligados e o escolhido gira. */
function BotoesSalvar() {
  const { pending, data } = useFormStatus();
  const ligando = pending && data?.get('ativo') === 'on';
  const desligando = pending && !ligando;
  return (
    <>
      <Button type="submit" name="ativo" value="off" variant="outline" disabled={pending} aria-busy={desligando || undefined}>
        {desligando ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Save aria-hidden size={16} strokeWidth={1.75} />}
        Salvar desligada
      </Button>
      <Button type="submit" name="ativo" value="on" disabled={pending} aria-busy={ligando || undefined}>
        {ligando ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Power aria-hidden size={16} strokeWidth={1.75} />}
        Salvar e ligar
      </Button>
    </>
  );
}

function FormularioEditor({ acao, orientacao, empresas, setores, aviso, avisoEmpresas, aoDescartar }: PropsEditor & { aoDescartar: () => void }) {
  const id = useId();
  const valeInicial: ValePara = orientacao?.clienteId ? 'empresa' : orientacao?.setorId ? 'setor' : 'todos';
  const [vale, setVale] = useState<ValePara>(valeInicial);
  const [titulo, setTitulo] = useState(orientacao?.titulo.length ?? 0);
  const [caracteres, setCaracteres] = useState(orientacao?.texto.length ?? 0);
  // Setor inativo só aparece quando já é o da orientação (o banco recusa escolher um setor inativo).
  const opcoesSetor = setores.filter((s) => s.ativo || s.id === orientacao?.setorId);
  const [erroEmpresa, setErroEmpresa] = useState<string | null>(null);
  const [setorEscolhido, setSetorEscolhido] = useState(orientacao?.setorId ?? '');
  const campoSetor = useRef<HTMLSelectElement>(null);

  // Como a empresa: fora de "Um setor", o select volta ao valor inicial (não conta como alteração); a escolha volta depois.
  useEffect(() => {
    const el = campoSetor.current;
    const alvo = vale === 'setor' ? setorEscolhido : orientacao?.setorId ?? '';
    if (!el || el.value === alvo) return;
    el.value = alvo;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [vale, setorEscolhido, orientacao?.setorId]);

  // Montou (abriu, descartou ou voltou do servidor): o simulador relê o rascunho.
  useEffect(() => { avisarRascunho(); }, []);

  // Campos não controlados: o estado local só acompanha o "vale para" e os contadores.
  const sincronizar = (f: HTMLFormElement) => {
    const marcado = f.querySelector<HTMLInputElement>('input[name="vale"]:checked');
    if (marcado) setVale(marcado.value as ValePara);
    const t = f.elements.namedItem('titulo');
    if (t instanceof HTMLInputElement) setTitulo(t.value.length);
    const x = f.elements.namedItem('texto');
    if (x instanceof HTMLTextAreaElement) setCaracteres(x.value.length);
    avisarRascunho();
  };

  // Antes de enviar: "Uma empresa" sem empresa escolhida não sai (o erro do servidor limparia o que foi digitado).
  const faltaEmpresa = (form: HTMLFormElement) => {
    const empresa = form.elements.namedItem('cliente_id');
    if (vale === 'empresa' && empresa instanceof HTMLInputElement && !empresa.value) {
      setErroEmpresa('Escolha a empresa.');
      document.getElementById(`${id}-empresa`)?.focus();
      return true;
    }
    return false;
  };
  const conferir = (e: FormEvent<HTMLFormElement>) => {
    if (faltaEmpresa(e.currentTarget)) e.preventDefault();
  };
  // Enter num campo do formulário (título, rádios) não envia: o Chrome pula o botão padrão desligado quando o Enter vem de
  // um rádio e clicaria SALVAR DESLIGADA, desligando uma orientação ligada (D12). Fora do formulário (busca da empresa,
  // aberta num portal) o Enter segue normal.
  const semEnter = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.currentTarget.contains(e.target)) e.preventDefault();
  };

  return (
    <FormularioAlteravel
      id={ID_FORM_ORIENTACAO}
      action={acao}
      onSubmit={conferir}
      onKeyDown={semEnter}
      onInput={(e) => sincronizar(e.currentTarget)}
      onChange={(e) => sincronizar(e.currentTarget)}
      onReset={(e) => {
        const f = e.currentTarget;
        setTimeout(() => sincronizar(f), 0);
      }}
      // "Salvar e sair" genérico enviaria sem ativo e desligaria a orientação (D12): aqui nunca salva para sair.
      salvarParaSair={async () => false}
      className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5"
    >
      {/* Botão padrão desligado, primeiro do formulário: Enter num campo de texto não envia (D12; HTML, envio implícito). Rádios: semEnter. */}
      {/* As duas proteções (semEnter e este botão padrão desligado) têm que ficar: uma cobre o que a outra não cobre. */}
      <button type="submit" disabled hidden aria-hidden tabIndex={-1} />
      {aviso}
      <FormField id={`${id}-titulo`} rotulo="Título" ajuda={<span className="tabular">{titulo} / {LIMITE_TITULO}</span>} obrigatorio>
        <Input name="titulo" defaultValue={orientacao?.titulo} maxLength={LIMITE_TITULO} placeholder="Ex.: Cumprimento" autoComplete="off" />
      </FormField>

      <div className="grid gap-5 xl:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
          <legend className={cn(ROTULO, 'mb-2')}>Tipo</legend>
          <div className="flex overflow-hidden rounded-md border border-input bg-surface">
            {TIPOS.map((t) => (
              <label key={t} className={SEGMENTO} title={DESCRICAO_TIPO[t]}>
                <input type="radio" name="tipo" value={t} defaultChecked={(orientacao?.tipo ?? 'jeito') === t} required className="sr-only" />
                {ROTULO_CURTO_TIPO[t]}
                <span className="sr-only">{ROTULO_TIPO[t].slice(ROTULO_CURTO_TIPO[t].length)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className={cn(ROTULO, 'mb-2')}>Vale para</legend>
          <div className="flex overflow-hidden rounded-md border border-input bg-surface">
            {VALE.map((v) => (
              <label key={v.valor} className={SEGMENTO}>
                <input type="radio" name="vale" value={v.valor} defaultChecked={valeInicial === v.valor} className="sr-only" />
                {v.antes && <span className="sr-only">{v.antes}</span>}
                {v.visivel}
                {v.depois && <span className="sr-only">{v.depois}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Empresa e setor ficam montados mesmo escondidos: trocar e voltar não perde a escolha. */}
      <div data-campo="empresa" className={cn(vale !== 'empresa' && 'hidden')}>
        <FormField
          id={`${id}-empresa`}
          rotulo={<span className="sr-only">Empresa</span>}
          ajuda={<>O agente segue esta orientação só nas conversas com esta empresa.{avisoEmpresas && <span className="block text-warning">{avisoEmpresas}</span>}</>}
          erro={erroEmpresa}
        >
          <EscolherEmpresa name="cliente_id" empresas={empresas} inicial={orientacao?.clienteId ?? null} ativo={vale === 'empresa'} aoMudar={() => setErroEmpresa(null)} />
        </FormField>
      </div>
      <div data-campo="setor" className={cn(vale !== 'setor' && 'hidden')}>
        <FormField id={`${id}-setor`} rotulo={<span className="sr-only">Setor</span>} ajuda="O agente segue esta orientação quando o assunto for deste setor.">
          <select
            ref={campoSetor}
            name="setor_id"
            defaultValue={orientacao?.setorId ?? ''}
            required={vale === 'setor'}
            onChange={(e) => setSetorEscolhido(e.target.value)}
            className={classeSelect}
          >
            <option value="">Escolha o setor</option>
            {opcoesSetor.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.ativo ? '' : ' (inativo)'}</option>)}
          </select>
        </FormField>
      </div>

      <FormField
        id={`${id}-texto`}
        rotulo="O que o agente deve fazer"
        ajuda="Escreva como falaria para um atendente novo. As regras fixas do agente continuam valendo."
        obrigatorio
      >
        <Textarea
          name="texto"
          defaultValue={orientacao?.texto}
          maxLength={LIMITE_TEXTO}
          rows={8}
          placeholder="Ex.: Comece sempre pelo nome do cliente e responda em no máximo duas frases."
        />
      </FormField>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <AvisoRascunho />
        <span className={cn('tabular', caracteres > LIMITE_TEXTO * 0.9 ? 'text-warning' : 'text-muted')}>
          {caracteres.toLocaleString('pt-BR')} / {LIMITE_TEXTO.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <BotaoDescartar aoDescartar={aoDescartar} />
        <BotoesSalvar />
      </div>
    </FormularioAlteravel>
  );
}

/**
 * Editor da orientação (coluna do meio, spec 7C.5): título, tipo, vale para, texto, DESCARTAR, SALVAR DESLIGADA e
 * SALVAR E LIGAR. O formulário tem o id ID_FORM_ORIENTACAO: o simulador lê dele o rascunho na hora do teste.
 * DESCARTAR recomeça o formulário com o que está salvo (a chave nova remonta campos e contadores, D13).
 */
export function EditorOrientacao(props: PropsEditor) {
  const [versao, setVersao] = useState(0);
  return <FormularioEditor key={versao} {...props} aoDescartar={() => setVersao((v) => v + 1)} />;
}
