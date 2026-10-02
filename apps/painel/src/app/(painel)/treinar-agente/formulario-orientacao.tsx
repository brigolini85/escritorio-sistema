'use client';

import { FlaskConical } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { EscolherEmpresa, type EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { FormField } from '@/components/patterns/form-field';
import { BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes, inicialRadix } from '@/components/patterns/formulario-alteravel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROTULO_DE_OPCAO } from '@/components/ui/rotulo-de-opcao';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { LIMITE_TEXTO, LIMITE_TITULO, ROTULO_TIPO, TIPOS, type TipoOrientacao } from '@/lib/orientacoes';
import { classeCaixa, classeSelect } from '../clientes/estilos';
import { OrientacaoForm, type ValePara } from './esquemas';
import { classeOpcao, DESCRICAO_TIPO } from './opcoes';
import { rascunhoDoFormulario, type RascunhoTeste } from './simulacao';
import { DialogTestarAgente } from './testar-agente';

type Acao = (dados: FormData) => void | Promise<void>;
export type SetorOpcao = { id: string; nome: string; ativo: boolean };
export type DadosFormulario = { titulo: string; texto: string; tipo: TipoOrientacao; clienteId: string | null; setorId: string | null; ativo: boolean };

const VALE: { valor: ValePara; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos os clientes' },
  { valor: 'empresa', rotulo: 'Uma empresa' },
  { valor: 'setor', rotulo: 'Um setor' },
];

/**
 * Formulário da orientação (painel lateral): titulo, tipo, vale (+ cliente_id ou setor_id), texto e ativo.
 * Campos nativos e não controlados (o FormularioAlteravel percebe o que mudou); o estado local só mostra/esconde
 * a empresa e o setor e conta os caracteres. Empresa e setor ficam montados mesmo escondidos: trocar e voltar não perde a escolha.
 */
export function FormularioOrientacao({
  acao,
  orientacao,
  idOrientacao = null,
  empresas,
  setores,
  aviso,
  avisoEmpresas,
}: {
  acao: Acao;
  orientacao?: DadosFormulario;
  /** Orientação salva sendo editada: o teste usa o rascunho no lugar dela. */
  idOrientacao?: string | null;
  empresas: EmpresaOpcao[];
  setores: SetorOpcao[];
  aviso?: ReactNode;
  /** A lista de empresas veio incompleta (aviso discreto no campo). */
  avisoEmpresas?: string | null;
}) {
  const id = useId();
  const valeInicial: ValePara = orientacao?.clienteId ? 'empresa' : orientacao?.setorId ? 'setor' : 'todos';
  const [vale, setVale] = useState<ValePara>(valeInicial);
  const [caracteres, setCaracteres] = useState(orientacao?.texto.length ?? 0);
  // Setor inativo só aparece quando já é o da orientação (o banco recusa escolher um setor inativo).
  const opcoesSetor = setores.filter((s) => s.ativo || s.id === orientacao?.setorId);
  const perto = caracteres > LIMITE_TEXTO * 0.9;
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

  // Antes de enviar: "Uma empresa" sem empresa escolhida não sai (o erro do servidor limparia o que foi digitado).
  // O setor usa o required do próprio select.
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

  // "Testar esta orientação": o que está no formulário agora (sem salvar) vai como rascunho do teste.
  const [rascunho, setRascunho] = useState<RascunhoTeste | null>(null);
  const [testando, setTestando] = useState(false);
  const testar = (e: MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form;
    if (!form || !form.reportValidity() || faltaEmpresa(form)) return;
    const d = OrientacaoForm.safeParse(new FormData(form));
    if (!d.success) {
      toast.error(d.error.issues[0]?.message ?? 'Confira os campos da orientação.');
      return;
    }
    setRascunho(rascunhoDoFormulario(d.data, idOrientacao));
    setTestando(true);
  };

  return (
    <>
    <FormularioAlteravel action={acao} onSubmit={conferir} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {aviso}
        <FormField id={`${id}-titulo`} rotulo="Título" ajuda="Um nome curto para achar a orientação na lista." obrigatorio>
          <Input name="titulo" defaultValue={orientacao?.titulo} maxLength={LIMITE_TITULO} placeholder="Ex.: Cumprimento" autoComplete="off" />
        </FormField>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-foreground">Tipo</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {TIPOS.map((t) => (
              <Label key={t} className={classeOpcao}>
                <input type="radio" name="tipo" value={t} defaultChecked={(orientacao?.tipo ?? 'jeito') === t} required className={cn(classeCaixa, 'mt-0.5')} />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{ROTULO_TIPO[t]}</span>
                  <span className="text-sm text-muted">{DESCRICAO_TIPO[t]}</span>
                </span>
              </Label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-foreground">Vale para</legend>
          <div className="flex flex-wrap gap-2">
            {VALE.map((v) => (
              <Label key={v.valor} className={cn(classeOpcao, 'items-center py-2')}>
                <input type="radio" name="vale" value={v.valor} defaultChecked={valeInicial === v.valor} onChange={() => setVale(v.valor)} className={classeCaixa} />
                {v.rotulo}
              </Label>
            ))}
          </div>
          <div className={cn(vale !== 'empresa' && 'hidden')}>
            <FormField id={`${id}-empresa`} rotulo="Empresa" ajuda={<>O agente segue esta orientação só nas conversas com esta empresa.{avisoEmpresas && <span className="block text-warning">{avisoEmpresas}</span>}</>} erro={erroEmpresa}>
              <EscolherEmpresa name="cliente_id" empresas={empresas} inicial={orientacao?.clienteId ?? null} ativo={vale === 'empresa'} aoMudar={() => setErroEmpresa(null)} />
            </FormField>
          </div>
          <div className={cn(vale !== 'setor' && 'hidden')}>
            <FormField id={`${id}-setor`} rotulo="Setor" ajuda="O agente segue esta orientação quando o assunto for deste setor.">
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
        </fieldset>

        <FormField
          id={`${id}-texto`}
          rotulo="O que o agente deve fazer"
          ajuda={(
            <span className="flex flex-wrap justify-between gap-2">
              <span>Escreva como falaria para um atendente novo. As regras fixas do agente continuam valendo.</span>
              <span className={cn('tabular', perto ? 'text-warning' : 'text-muted')}>
                {caracteres.toLocaleString('pt-BR')} / {LIMITE_TEXTO.toLocaleString('pt-BR')}
              </span>
            </span>
          )}
          obrigatorio
        >
          <Textarea
            name="texto"
            defaultValue={orientacao?.texto}
            maxLength={LIMITE_TEXTO}
            rows={7}
            placeholder="Ex.: Comece sempre pelo nome do cliente e responda em no máximo duas frases."
            onInput={(e) => setCaracteres(e.currentTarget.value.length)}
          />
        </FormField>

        <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
          <div>
            <Label htmlFor={`${id}-ativo`} className={cn('cursor-pointer text-base', ROTULO_DE_OPCAO)}>Ligada</Label>
            <p id={`${id}-ativo-descricao`} className="text-sm text-muted">Ligada, o agente segue a orientação a partir da próxima mensagem. Desligada, ela fica guardada sem valer.</p>
          </div>
          <Switch id={`${id}-ativo`} name="ativo" defaultChecked={orientacao?.ativo ?? false} {...inicialRadix(orientacao?.ativo ?? false)} aria-describedby={`${id}-ativo-descricao`} className="mt-0.5" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border p-4">
        <Button type="button" variant="outline" onClick={testar} className="mr-auto">
          <FlaskConical aria-hidden size={16} strokeWidth={1.75} />
          Testar esta orientação
        </Button>
        <IndicadorAlteracoes />
        <BotaoSalvar>Salvar orientação</BotaoSalvar>
      </div>
    </FormularioAlteravel>
    {/* Fora do <form> na árvore do React: os eventos do Dialog (portal) não chegam ao formulário da orientação. */}
    <DialogTestarAgente aberto={testando} aoMudarAberto={setTestando} rascunho={rascunho} />
    </>
  );
}
