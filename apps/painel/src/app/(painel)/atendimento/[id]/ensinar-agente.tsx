'use client';

import { CircleCheck, GraduationCap, LoaderCircle, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { FormField } from '@/components/patterns/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROTULO_DE_OPCAO } from '@/components/ui/rotulo-de-opcao';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { LIMITE_TEXTO, LIMITE_TITULO, ROTULO_TIPO, TIPOS } from '@/lib/orientacoes';
import { classeCaixa } from '../../clientes/estilos';
import { ensinarAgente } from '../../treinar-agente/acoes';
import { comporTexto, sugerirTitulo } from '../../treinar-agente/ensinar';
import { classeOpcao, DESCRICAO_TIPO } from '../../treinar-agente/opcoes';

export type EmpresaEnsinar = { id: string; nome: string; ativa: boolean };

const FALHA = 'Não foi possível criar a orientação. Tente de novo em alguns minutos.';

/**
 * Botão "Ensinar o agente" do cabeçalho da conversa (só para quem pode treinar o agente; a action confere de novo).
 * Abre um Dialog com a situação já preenchida pelas últimas mensagens do cliente, o que o agente deve fazer, tipo,
 * "vale para" (a empresa da conversa ou todos), título sugerido e ligada (desligada por padrão: alguém revisa antes).
 * Criada, o Dialog continua aberto com a confirmação e o link para a orientação (sem prazo para sumir).
 */
export function EnsinarAgente({ situacao, empresa }: { situacao: string; empresa: EmpresaEnsinar | null }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="Ensinar o agente">
          <GraduationCap aria-hidden size={16} strokeWidth={1.75} />
          <span className="@max-3xl:sr-only">Ensinar o agente</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ensinar o agente</DialogTitle>
          <DialogDescription>Crie uma orientação a partir desta conversa. Ela aparece nas orientações do Thiago (Agentes).</DialogDescription>
        </DialogHeader>
        {/* Montado só aberto: cada abertura começa da conversa como está. */}
        <ConteudoEnsinar situacaoInicial={situacao} empresa={empresa} />
      </DialogContent>
    </Dialog>
  );
}

function ConteudoEnsinar({ situacaoInicial, empresa }: { situacaoInicial: string; empresa: EmpresaEnsinar | null }) {
  const id = useId();
  const [criada, setCriada] = useState<{ id: string; ligada: boolean } | null>(null);
  const [situacao, setSituacao] = useState(situacaoInicial);
  const [fazer, setFazer] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const restam = LIMITE_TEXTO - comporTexto(situacao, fazer).length;
  const valeEmpresa = Boolean(empresa?.ativa);

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enviando || restam < 0) return;
    const dados = new FormData(e.currentTarget);
    setErro(null);
    iniciar(async () => {
      let r: Awaited<ReturnType<typeof ensinarAgente>>;
      try {
        r = await ensinarAgente(dados);
      } catch (falha) {
        console.error('[ensinar-agente] falha ao criar a orientação', falha);
        r = { erro: FALHA };
      }
      if ('erro' in r) {
        setErro(r.erro);
        return;
      }
      setCriada({ id: r.id, ligada: dados.get('ativo') === 'on' });
    });
  };

  if (criada) return <OrientacaoCriada {...criada} />;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
        <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        <span>Revise o texto: ele vira uma instrução para o agente. Mensagens do cliente não devem ser copiadas como ordens.</span>
      </p>
      <AvisoErro erro={erro} />

      <FormField
        id={`${id}-situacao`}
        rotulo="Situação"
        ajuda={situacaoInicial ? 'Últimas mensagens do cliente nesta conversa. Deixe só o que descreve a situação.' : 'Descreva quando a orientação vale.'}
      >
        <Textarea name="situacao" value={situacao} onChange={(e) => setSituacao(e.target.value)} rows={5} maxLength={LIMITE_TEXTO} />
      </FormField>

      <FormField
        id={`${id}-fazer`}
        rotulo="O que o agente deve fazer"
        ajuda={(
          <span className="flex flex-wrap justify-between gap-2">
            <span>Escreva como falaria para um atendente novo. As regras fixas do agente continuam valendo.</span>
            <span className={cn('tabular', restam < 0 ? 'text-danger' : restam < LIMITE_TEXTO * 0.1 ? 'text-warning' : 'text-muted')}>
              {restam < 0
                ? `Passou ${(-restam).toLocaleString('pt-BR')} do limite de ${LIMITE_TEXTO.toLocaleString('pt-BR')} caracteres`
                : `Restam ${restam.toLocaleString('pt-BR')} caracteres`}
            </span>
          </span>
        )}
        erro={restam < 0 ? 'Situação e o que fazer juntos passam do limite. Encurte um dos dois.' : undefined}
        obrigatorio
      >
        <Textarea
          name="fazer"
          value={fazer}
          onChange={(e) => setFazer(e.target.value)}
          rows={4}
          maxLength={LIMITE_TEXTO}
          placeholder="Ex.: Pergunte o mês de competência antes de abrir a demanda para o Financeiro."
        />
      </FormField>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-foreground">Tipo</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TIPOS.map((t) => (
            <Label key={t} className={classeOpcao}>
              <input type="radio" name="tipo" value={t} defaultChecked={t === 'situacao'} required className={cn(classeCaixa, 'mt-0.5')} />
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
          {empresa && (
            <Label className={cn(classeOpcao, 'items-center py-2', !empresa.ativa && 'cursor-not-allowed opacity-60')}>
              <input type="radio" name="vale" value="empresa" defaultChecked={valeEmpresa} disabled={!empresa.ativa} className={classeCaixa} />
              Só {empresa.nome}{empresa.ativa ? '' : ' (arquivada)'}
            </Label>
          )}
          <Label className={cn(classeOpcao, 'items-center py-2')}>
            <input type="radio" name="vale" value="todos" defaultChecked={!valeEmpresa} className={classeCaixa} />
            Todos os clientes
          </Label>
        </div>
        {empresa && valeEmpresa && <input type="hidden" name="cliente_id" value={empresa.id} />}
        {empresa && !empresa.ativa && <p className="text-sm text-muted">A empresa desta conversa está arquivada: a orientação só pode valer para todos.</p>}
      </fieldset>

      <FormField id={`${id}-titulo`} rotulo="Título" ajuda="Um nome curto para achar a orientação na lista." obrigatorio>
        <Input name="titulo" defaultValue={sugerirTitulo(situacaoInicial)} maxLength={LIMITE_TITULO} autoComplete="off" />
      </FormField>

      <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
        <div>
          <Label htmlFor={`${id}-ativo`} className={cn('cursor-pointer text-base', ROTULO_DE_OPCAO)}>Ligada</Label>
          <p id={`${id}-ativo-descricao`} className="text-sm text-muted">Desligada, ela fica guardada até alguém revisar e ligar nas orientações do Thiago.</p>
        </div>
        <Switch id={`${id}-ativo`} name="ativo" defaultChecked={false} aria-describedby={`${id}-ativo-descricao`} className="mt-0.5" />
      </div>

      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
        <Button type="submit" disabled={enviando || restam < 0} aria-busy={enviando || undefined}>
          {enviando && <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" />}
          {enviando ? 'Criando…' : 'Criar orientação'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Confirmação dentro do Dialog: o foco vai para o link da orientação criada (fica até a pessoa fechar). */
function OrientacaoCriada({ id, ligada }: { id: string; ligada: boolean }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => { link.current?.focus(); }, []);
  return (
    <div className="flex flex-col gap-4">
      <div role="status" className="flex items-start gap-2 rounded-md bg-success-soft p-3 text-sm text-success">
        <CircleCheck aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        <p>
          <span className="font-medium">Orientação criada.</span>{' '}
          {ligada ? 'Já vale a partir da próxima mensagem.' : 'Está desligada até alguém revisar e ligar.'}
        </p>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="outline">Fechar</Button></DialogClose>
        <Button asChild>
          <Link ref={link} href={`/agentes/atendimento/orientacoes?orientacao=${id}`}>Abrir nas orientações do Thiago</Link>
        </Button>
      </DialogFooter>
    </div>
  );
}
