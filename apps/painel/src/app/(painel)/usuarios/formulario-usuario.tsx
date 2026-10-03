'use client';

import { CircleAlert, TriangleAlert } from 'lucide-react';
import { unstable_rethrow } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { FormField } from '@/components/patterns/form-field';
import { BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes, inicialRadix } from '@/components/patterns/formulario-alteravel';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROTULO_DE_OPCAO } from '@/components/ui/rotulo-de-opcao';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { classeSelect } from '../clientes/estilos';
import { PERMISSOES, type EstadoUsuario } from './esquemas';

type Acao = (dados: FormData) => Promise<EstadoUsuario>;
const FALHA = 'Não consegui salvar agora. Tente de novo.';
export type SetorOpcao = { id: string; nome: string; ativo: boolean };
export type DadosUsuario = { nome: string; email: string; telefone: string | null; papel: 'admin' | 'atendente'; setores: string[]; permissoes: string[]; ativo: boolean };

/** Uma linha sobre o que cada permissão libera (o rótulo continua o de PERMISSOES, o mesmo que a action conhece). */
const DESCRICAO_PERMISSAO: Record<(typeof PERMISSOES)[number]['valor'], string> = {
  editar_clientes: 'Cadastra e muda empresas, contatos, unidades, produtos e documentos.',
  editar_precos: 'Muda os preços por rede na ficha da empresa.',
  emitir_notas: 'Libera o CSV do Bling nas Demandas e no Assistente.',
  assistente_site: 'Abre a tela Assistente e a aba do assistente no Atendimento.',
  assistente_whatsapp: 'Conversa com o assistente mandando mensagem do telefone cadastrado.',
  treinar_agente: 'Escreve e liga as orientações que o agente segue no atendimento.',
};
const PERMISSOES_DE_EDICAO = new Set(['editar_clientes', 'editar_precos', 'emitir_notas', 'treinar_agente']);

/** Erro sem campo (banco, convite recusado): dentro do formulário, no painel, não no topo da página. */
function AvisoErro({ erro }: { erro: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
      <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>{erro}</span>
    </p>
  );
}

/**
 * Formulário da pessoa (editar no painel lateral ou convidar na janela). Os mesmos campos de antes:
 * nome, email, telefone, papel, setor (vários), permissao (várias). Switch e Checkbox
 * (Radix) enviam name=value quando marcados, como as caixas nativas enviavam.
 * O aviso de WhatsApp sem telefone aparece na hora, mas não impede o envio: quem decide é o servidor
 * ("Informe o telefone para usar o assistente pelo WhatsApp"). Os erros voltam da ação e aparecem no campo
 * (ou no aviso do formulário), sem fechar o painel nem perder o que foi digitado.
 */
export function FormularioUsuario({
  acao,
  usuario,
  setores,
  enviar,
  aviso,
  aoSalvar,
  className,
}: {
  acao: Acao;
  usuario?: DadosUsuario;
  setores: SetorOpcao[];
  /** Texto do botão: "Salvar usuário" ou "Enviar convite". */
  enviar: string;
  /** Aviso acima dos campos (ex.: o telefone também é de um contato). */
  aviso?: ReactNode;
  /** Depois de salvar (a janela do convite fecha). */
  aoSalvar?: () => void;
  className?: string;
}) {
  const id = useId();
  const editando = Boolean(usuario);
  const [telefone, setTelefone] = useState(usuario?.telefone ?? '');
  const [whatsapp, setWhatsapp] = useState(usuario?.permissoes.includes('assistente_whatsapp') ?? false);
  const [papel, setPapel] = useState(usuario?.papel ?? 'atendente');
  const semTelefone = whatsapp && !telefone.trim();
  const [estado, setEstado] = useState<EstadoUsuario | null>(null);
  const [enviando, iniciar] = useTransition();
  const erros = estado && !estado.ok ? estado.erros : {};

  const enviarFormulario = (e: FormEvent<HTMLFormElement>) => {
    // Envio pela própria tela (sem action no <form>): o React não limpa os campos, então o erro aparece no campo
    // com o painel aberto e tudo o que foi digitado (sobra 6 da Parte B).
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await acao(dados);
        setEstado(r);
        if (!r.ok) return;
        toast.success(editando
          ? `Salvo: ${String(dados.get('nome') ?? '').trim()}.`
          : `Convite enviado para ${String(dados.get('email') ?? '').trim().toLowerCase()}.`);
        aoSalvar?.();
      } catch (err) {
        unstable_rethrow(err);
        console.error('[usuarios] falha ao salvar', err);
        setEstado({ ok: false, erros: { geral: FALHA } });
      }
    });
  };

  return (
    <FormularioAlteravel onSubmit={enviarFormulario} className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {aviso}
        {erros.geral && <AvisoErro erro={erros.geral} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id={`${id}-nome`} rotulo="Nome" erro={erros.nome}>
            <Input name="nome" defaultValue={usuario?.nome} placeholder="Nome" required autoComplete="off" />
          </FormField>
          <FormField id={`${id}-email`} rotulo="E-mail" ajuda={editando ? 'O e-mail de acesso não muda aqui.' : undefined} erro={erros.email}>
            <Input name="email" type={editando ? 'text' : 'email'} defaultValue={usuario?.email} placeholder="E-mail" required readOnly={editando} autoComplete="off" className={cn(editando && 'bg-surface-muted text-muted')} />
          </FormField>
          <FormField id={`${id}-telefone`} rotulo="Telefone" erro={erros.telefone}>
            <Input
              name="telefone"
              defaultValue={usuario?.telefone ?? ''}
              placeholder="Telefone com DDD (para o assistente pelo WhatsApp)"
              inputMode="tel"
              autoComplete="off"
              onChange={(e) => setTelefone(e.target.value)}
            />
          </FormField>
          <FormField id={`${id}-papel`} rotulo="Papel" erro={erros.papel}>
            <select name="papel" defaultValue={usuario?.papel ?? 'atendente'} onChange={(e) => setPapel(e.target.value as 'admin' | 'atendente')} className={classeSelect}>
              <option value="atendente">Atendente</option>
              <option value="admin">Administrador</option>
            </select>
          </FormField>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-foreground">Setores</legend>
          {setores.length === 0 ? (
            <p className="text-sm text-muted">Nenhum setor cadastrado. Crie em Configurações.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {setores.map((s) => (
                <Label
                  key={s.id}
                  htmlFor={`${id}-setor-${s.id}`}
                  className={cn(
                    ROTULO_DE_OPCAO,
                    'h-8 cursor-pointer rounded-md border border-input bg-surface px-3 text-base has-data-[state=checked]:border-brand has-data-[state=checked]:bg-brand-soft',
                    !s.ativo && 'text-muted',
                  )}
                >
                  <Checkbox id={`${id}-setor-${s.id}`} name="setor" value={s.id} defaultChecked={usuario?.setores.includes(s.id)} {...inicialRadix(usuario?.setores.includes(s.id))} />
                  {s.nome}{s.ativo ? '' : ' (inativo)'}
                </Label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col">
          <legend className="mb-1 text-sm font-medium text-foreground">Permissões</legend>
          {papel === 'admin' && (
            <p className="mb-1 text-sm text-muted">O administrador já pode editar clientes, preços e pedidos de nota, e treinar o agente. As do assistente valem para ele também.</p>
          )}
          <ul className="flex flex-col divide-y divide-border">
            {PERMISSOES.map((p) => {
              const idCampo = `${id}-permissao-${p.valor}`;
              const implicita = papel === 'admin' && PERMISSOES_DE_EDICAO.has(p.valor);
              return (
                <li key={p.valor} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <Label htmlFor={idCampo} className={cn('cursor-pointer text-base', ROTULO_DE_OPCAO, implicita && 'text-muted')}>{p.rotulo}</Label>
                    <p id={`${idCampo}-descricao`} className="text-sm text-muted">{DESCRICAO_PERMISSAO[p.valor]}</p>
                    {p.valor === 'assistente_whatsapp' && semTelefone && (
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-warning">
                        <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                        Sem telefone o assistente não reconhece a pessoa pelo WhatsApp. Preencha o telefone acima.
                      </p>
                    )}
                  </div>
                  <Switch
                    id={idCampo}
                    name="permissao"
                    value={p.valor}
                    defaultChecked={usuario?.permissoes.includes(p.valor)}
                    {...inicialRadix(usuario?.permissoes.includes(p.valor))}
                    aria-describedby={`${idCampo}-descricao`}
                    onCheckedChange={p.valor === 'assistente_whatsapp' ? setWhatsapp : undefined}
                    className="mt-0.5"
                  />
                </li>
              );
            })}
          </ul>
        </fieldset>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border p-4">
        <IndicadorAlteracoes />
        <BotaoSalvar enviando={enviando}>{enviar}</BotaoSalvar>
      </div>
    </FormularioAlteravel>
  );
}
