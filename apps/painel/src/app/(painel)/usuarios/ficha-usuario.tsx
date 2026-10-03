'use client';

import { NIVEIS, NIVEIS_PADRAO, type Modulo, type Niveis } from '@escritorio/core';
import { CircleAlert, Save, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { BotaoRestaurar } from '@/components/patterns/excluir-cadastro';
import { FormField } from '@/components/patterns/form-field';
import { BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes, inicialRadix } from '@/components/patterns/formulario-alteravel';
import { variantesBotao } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROTULO_DE_OPCAO } from '@/components/ui/rotulo-de-opcao';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { DIAS_HORARIO, HORARIO_PADRAO, type DiaHorario, type HorarioAcesso } from '@/lib/horario-acesso';
import { AJUDA_MODULO, ROTULO_MODULO, rotuloNivel } from '@/lib/permissoes';
import { classeSelect } from '../clientes/estilos';
import type { EstadoUsuario } from './esquemas';

type Acao = (dados: FormData) => Promise<EstadoUsuario>;
export type SetorOpcao = { id: string; nome: string; ativo: boolean };
export type FichaDados = {
  id: string; nome: string; email: string; telefone: string | null; cargo: string | null; papel: 'admin' | 'atendente';
  setores: string[]; niveis: Niveis; horario: HorarioAcesso | null; observacoes: string | null;
};

const FALHA = 'Não consegui salvar agora. Tente de novo.';
// Ordem da imagem 06 (três por linha).
const MODULOS_DA_TELA: Modulo[] = ['atendimento', 'demandas', 'clientes', 'precos', 'notas', 'assistente', 'treinar', 'prazos', 'configuracoes'];
const titulo = 'border-b border-border pb-2 text-base font-semibold text-foreground';

function AvisoErro({ erro }: { erro: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
      <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>{erro}</span>
    </p>
  );
}

/**
 * Ficha da pessoa em página inteira (spec 7.1, imagem 06): 3 colunas, permissões por módulo, horário e situação.
 * "Administrador = Sim" esconde e desliga (fieldset disabled) permissões e horário: nada é enviado nem apagado, e
 * voltar para "Não" mostra o que estava escolhido. Erro ao salvar fica no campo, com tudo o que foi digitado.
 */
export function FichaUsuario({ usuario, eu, setores, cargos, acao, aviso, situacao, rodape }: {
  usuario: FichaDados | null;
  /** id de quem está logado: na própria ficha o "Administrador?" fica travado (P16). */
  eu: string;
  setores: SetorOpcao[];
  cargos: string[];
  acao: Acao;
  aviso?: ReactNode;
  situacao: ReactNode;
  rodape: ReactNode;
}) {
  const id = useId();
  const router = useRouter();
  const editando = usuario !== null;
  const propria = usuario?.id === eu;
  const niveis = usuario?.niveis ?? NIVEIS_PADRAO;
  const horarioInicial = usuario ? usuario.horario : HORARIO_PADRAO;
  const faixas = horarioInicial ?? HORARIO_PADRAO;
  const [papel, setPapel] = useState<'admin' | 'atendente'>(usuario?.papel ?? 'atendente');
  const [restrito, setRestrito] = useState(horarioInicial !== null);
  const [dias, setDias] = useState<Record<DiaHorario, boolean>>({
    semana: faixas.semana !== null, sabado: faixas.sabado !== null, domingo: faixas.domingo !== null,
  });
  const [estado, setEstado] = useState<EstadoUsuario | null>(null);
  const [enviando, iniciar] = useTransition();
  const erros = estado && !estado.ok ? estado.erros : {};
  const admin = papel === 'admin';

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    // Envio pela própria tela: o React não limpa os campos, então o erro aparece no campo com tudo o que foi digitado.
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await acao(dados);
        setEstado(r);
        if (!r.ok) return;
        if (editando) {
          toast.success(`Salvo: ${String(dados.get('nome') ?? '').trim()}.`);
          router.refresh();
        } else {
          toast.success(`Convite enviado para ${String(dados.get('email') ?? '').trim().toLowerCase()}.`);
          router.push(`/usuarios/${r.id}`);
        }
      } catch (err) {
        unstable_rethrow(err);
        console.error('[usuarios] falha ao salvar', err);
        setEstado({ ok: false, erros: { geral: FALHA } });
      }
    });
  };

  return (
    <FormularioAlteravel onSubmit={enviar} aria-label={editando ? `Cadastro de ${usuario.nome}` : 'Nova pessoa'} className="rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-8 p-6">
        {aviso}
        {erros.geral && <AvisoErro erro={erros.geral} />}

        <div className="grid gap-4 md:grid-cols-3">
          <FormField id={`${id}-nome`} rotulo="Nome" erro={erros.nome}>
            <Input name="nome" defaultValue={usuario?.nome} required autoComplete="off" />
          </FormField>
          <FormField id={`${id}-email`} rotulo="E-mail de acesso" ajuda={editando ? 'O e-mail de acesso não muda aqui.' : undefined} erro={erros.email}>
            <Input name="email" type={editando ? 'text' : 'email'} defaultValue={usuario?.email} required readOnly={editando} autoComplete="off"
              className={cn(editando && 'bg-surface-muted text-muted')} />
          </FormField>
          <FormField id={`${id}-cargo`} rotulo="Cargo" ajuda="Informativo. Escolha ou digite outro." erro={erros.cargo}>
            <Input name="cargo" list={`${id}-cargos`} defaultValue={usuario?.cargo ?? ''} maxLength={60} autoComplete="off" />
          </FormField>
          <datalist id={`${id}-cargos`}>{cargos.map((c) => <option key={c} value={c} />)}</datalist>

          <fieldset className="flex flex-col gap-1.5" aria-describedby={erros.setores ? `${id}-setores-erro` : undefined}>
            <legend className="mb-1.5 text-sm font-medium text-foreground">Setores</legend>
            {setores.length === 0 ? (
              <p className="text-sm text-muted">Nenhum setor cadastrado. Crie em Configurações.</p>
            ) : (
              <div className="flex min-h-9 flex-wrap gap-2 rounded-md border border-input bg-surface p-1.5">
                {setores.map((s) => (
                  <Label key={s.id} htmlFor={`${id}-setor-${s.id}`}
                    className={cn(ROTULO_DE_OPCAO, 'h-7 cursor-pointer rounded-md border border-input px-2.5 text-base has-data-[state=checked]:border-brand has-data-[state=checked]:bg-brand-soft',
                      !s.ativo && 'text-muted')}>
                    <Checkbox id={`${id}-setor-${s.id}`} name="setor" value={s.id} defaultChecked={usuario?.setores.includes(s.id)} {...inicialRadix(usuario?.setores.includes(s.id))} />
                    {s.nome}{s.ativo ? '' : ' (inativo)'}
                  </Label>
                ))}
              </div>
            )}
            {erros.setores && <p id={`${id}-setores-erro`} className="text-sm text-danger">{erros.setores}</p>}
          </fieldset>
          <FormField id={`${id}-telefone`} rotulo="Telefone (WhatsApp)" ajuda="Com DDD. Necessário para o assistente pelo WhatsApp." erro={erros.telefone}>
            <Input name="telefone" defaultValue={usuario?.telefone ?? ''} inputMode="tel" autoComplete="off" />
          </FormField>
          <FormField id={`${id}-papel`} rotulo="Administrador?"
            ajuda={propria ? 'Você não pode tirar o seu próprio acesso de administrador.' : 'Sim = acesso total, esconde as permissões.'} erro={erros.papel}>
            <select name="papel" defaultValue={usuario?.papel ?? 'atendente'} disabled={propria}
              onChange={(e) => setPapel(e.target.value as 'admin' | 'atendente')} className={classeSelect}>
              <option value="atendente">Não</option>
              <option value="admin">Sim</option>
            </select>
          </FormField>
          {/* Campo travado não vai no formulário: o valor segue escondido. */}
          {propria && <input type="hidden" name="papel" value="admin" />}
          {estado && !estado.ok && estado.telefoneDeArquivado && (
            <div className="md:col-span-3">
              <BotaoRestaurar tipo="usuario" id={estado.telefoneDeArquivado.id} nome={estado.telefoneDeArquivado.nome} aoRestaurar={() => setEstado(null)} />
            </div>
          )}
        </div>

        <section aria-labelledby={`${id}-permissoes`} className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
            <h2 id={`${id}-permissoes`} className="text-base font-semibold text-foreground">Permissões</h2>
            <span className="text-sm text-muted">{admin ? 'administrador: acesso total' : 'cada módulo tem níveis'}</span>
          </div>
          {erros.niveis && <p role="alert" className="text-sm text-danger">{erros.niveis}</p>}
          <div className="grid gap-4 md:grid-cols-3">
            {MODULOS_DA_TELA.map((m) => {
              const campo = (
                <FormField id={`${id}-nivel-${m}`} rotulo={ROTULO_MODULO[m]} ajuda={AJUDA_MODULO[m]}>
                  <select name={`nivel_${m}`} defaultValue={niveis[m]} className={classeSelect}>
                    {NIVEIS[m].map((n) => <option key={n} value={n}>{rotuloNivel(m, n as never)}</option>)}
                  </select>
                </FormField>
              );
              // Assistente é canal (P3): continua para o administrador.
              if (m === 'assistente') return <div key={m}>{campo}</div>;
              return <fieldset key={m} disabled={admin} className={admin ? 'hidden' : 'contents'}>{campo}</fieldset>;
            })}
          </div>
          {admin && <p className="text-sm text-muted">O administrador pode tudo no painel. O assistente continua por nível, como antes.</p>}
        </section>

        <div className="grid gap-8 md:grid-cols-5">
          <section aria-labelledby={`${id}-horario`} className="flex flex-col gap-4 md:col-span-3">
            <h2 id={`${id}-horario`} className={titulo}>Horário de acesso ao painel</h2>
            {admin && <p className="text-sm text-muted">O administrador entra a qualquer hora.</p>}
            <fieldset disabled={admin} className={cn('flex flex-col gap-4', admin && 'hidden')}>
              <FormField id={`${id}-restrito`} rotulo="Restringir o horário?" erro={erros.horario}>
                <select name="horario_restrito" defaultValue={restrito ? 'sim' : 'nao'} onChange={(e) => setRestrito(e.target.value === 'sim')} className={cn(classeSelect, 'sm:w-72')}>
                  <option value="nao">Não, entra a qualquer hora</option>
                  <option value="sim">Sim, só nos horários abaixo</option>
                </select>
              </FormField>
              <fieldset disabled={!restrito} className={cn('flex flex-col gap-3', !restrito && 'hidden')}>
                <legend className="sr-only">Dias e horários</legend>
                {DIAS_HORARIO.map(({ chave, rotulo }) => {
                  const faixa = faixas[chave] ?? { de: '08:00', ate: chave === 'sabado' ? '12:00' : '18:00' };
                  return (
                    <div key={chave} className="flex flex-wrap items-center gap-3">
                      <span id={`${id}-dia-${chave}`} className="w-24 font-medium text-foreground">{rotulo}</span>
                      <select name={`horario_${chave}`} aria-labelledby={`${id}-dia-${chave}`} defaultValue={dias[chave] ? 'permitido' : 'bloqueado'}
                        onChange={(e) => setDias((d) => ({ ...d, [chave]: e.target.value === 'permitido' }))}
                        className={cn(classeSelect, 'w-40', dias[chave] ? 'text-success' : 'text-danger')}>
                        <option value="permitido">● Permitido</option>
                        <option value="bloqueado">● Bloqueado</option>
                      </select>
                      <fieldset disabled={!dias[chave]} className={cn('flex items-center gap-2', !dias[chave] && 'hidden')}>
                        <legend className="sr-only">{rotulo}: horário</legend>
                        <Input type="time" name={`horario_${chave}_de`} defaultValue={faixa.de} aria-label={`${rotulo}: das`} className="tabular w-32" />
                        <span className="text-muted">às</span>
                        <Input type="time" name={`horario_${chave}_ate`} defaultValue={faixa.ate} aria-label={`${rotulo}: até`} className="tabular w-32" />
                      </fieldset>
                    </div>
                  );
                })}
              </fieldset>
            </fieldset>
          </section>

          <section aria-labelledby={`${id}-situacao`} className="flex flex-col gap-4 md:col-span-2">
            <h2 id={`${id}-situacao`} className={titulo}>Situação</h2>
            {situacao}
            <FormField id={`${id}-obs`} rotulo="Observações" erro={erros.observacoes}>
              <Textarea name="observacoes" defaultValue={usuario?.observacoes ?? ''} rows={2} maxLength={1000} placeholder="Ex.: férias de 10 a 24/11" />
            </FormField>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-brand px-6 py-4">
        <div className="text-sm text-muted">{rodape}</div>
        <div className="flex items-center gap-3">
          <IndicadorAlteracoes />
          <Link href="/usuarios" className={variantesBotao({ variant: 'outline' })}>
            <Undo2 aria-hidden size={16} strokeWidth={1.75} />
            Voltar
          </Link>
          <BotaoSalvar enviando={enviando}>
            <Save aria-hidden size={16} strokeWidth={1.75} />
            Salvar
          </BotaoSalvar>
        </div>
      </div>
    </FormularioAlteravel>
  );
}
