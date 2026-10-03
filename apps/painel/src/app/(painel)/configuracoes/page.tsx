import { CalendarOff, MessageSquareText, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { EmptyState } from '@/components/patterns/empty-state';
import { FormField } from '@/components/patterns/form-field';
import { BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes } from '@/components/patterns/formulario-alteravel';
import { HealthSignal } from '@/components/patterns/health-signal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { formatarData, formatarUSD } from '@/lib/formatos';
import { LIMITES_BATIMENTO, situacaoTeto } from '@/lib/inicio';
import { exigirConfiguracoes } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { classeCaixa, classeSelect } from '../clientes/estilos';
import { gastoDoMes } from '../inicio/gasto-do-mes';
import {
  adicionarFeriado, removerFeriado, removerResposta, salvarAvisoLogin, salvarExpediente, salvarMensagens,
  salvarPrazos, salvarResposta, salvarServico, salvarSetor, salvarTetoAlertas,
} from './acoes';
import { CampoEmail, CampoNomeUnico } from './campos-validados';
import { HorarioExpediente } from './horario-expediente';
import { NavegacaoSecoes, type SecaoConfiguracao } from './navegacao-secoes';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_EXTENSO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const SECOES: SecaoConfiguracao[] = [
  { id: 'expediente', rotulo: 'Expediente' },
  { id: 'prazos', rotulo: 'Prazos' },
  { id: 'teto-ia', rotulo: 'Teto de IA' },
  { id: 'mensagens', rotulo: 'Mensagens automáticas' },
  { id: 'setores', rotulo: 'Setores' },
  { id: 'servicos', rotulo: 'Serviços' },
  { id: 'respostas', rotulo: 'Respostas prontas' },
  { id: 'feriados', rotulo: 'Feriados' },
  { id: 'integracoes', rotulo: 'Integrações' },
];

const MENSAGENS = [
  { chave: 'aviso_lgpd', rotulo: 'Aviso de privacidade (primeiro contato)' },
  { chave: 'fora_do_horario', rotulo: 'Fora do horário', ajuda: '{inicio} e {fim} viram os horários do expediente.' },
  { chave: 'ia_indisponivel', rotulo: 'IA indisponível' },
];

/** Card de uma seção, com âncora para a navegação interna. */
/** `escopo`: o indicador de alterações do card conta só os campos deste card (quando o formulário ocupa dois cards). */
function Secao({ id, titulo, descricao, children, className, escopo = false }: { id: string; titulo: string; descricao?: ReactNode; children: ReactNode; className?: string; escopo?: boolean }) {
  return (
    <Card id={id} aria-labelledby={`${id}-titulo`} role="region" className={cn('ancora-abaixo-cabecalho', className)} data-escopo-alteracoes={escopo ? '' : undefined}>
      <CardHeader>
        <CardTitle id={`${id}-titulo`}>{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      {children}
    </Card>
  );
}

/** Rodapé do card com o indicador de alterações e o Salvar da seção. */
function RodapeSalvar({ rotulo = 'Salvar' }: { rotulo?: string }) {
  return (
    <CardFooter className="flex-wrap justify-end">
      <IndicadorAlteracoes />
      <BotaoSalvar size="sm">{rotulo}</BotaoSalvar>
    </CardFooter>
  );
}

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const u = await exigirConfiguracoes();
  // "Configurações: Sim" (P12): teto de IA, alertas, integrações e usuários continuam só do administrador.
  const admin = u.papel === 'admin';
  const sb = await supabaseServidor();
  const agora = new Date();
  const [{ data: cfg }, { data: setores }, { data: servicos }, { data: respostas }, { data: feriados }, { data: sinais }, gasto] = await Promise.all([
    sb.from('configuracoes').select('*').eq('id', 1).single(),
    sb.from('setores').select('*').order('nome'),
    sb.from('servicos').select('*').order('nome'),
    sb.from('respostas_prontas').select('*').order('pergunta'),
    sb.from('feriados').select('*').order('data'),
    admin ? sb.from('sinais_vida').select('*') : Promise.resolve({ data: null }),
    admin ? gastoDoMes(sb, u.id, agora) : Promise.resolve(null),
  ]);
  const mensagens = (cfg?.mensagens ?? {}) as Record<string, string>;
  const sinal = (c: string) => sinais?.find((s) => s.componente === c)?.visto_em ?? null;
  const teto = cfg && gasto ? situacaoTeto(gasto.total, Number(cfg.teto_ia_usd)) : null;
  const nomesSetores = (setores ?? []).map((x) => x.nome);
  const nomesServicos = (servicos ?? []).map((x) => x.nome);
  const opcoesSetor = (setores ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome}{x.ativo ? '' : ' (inativo)'}</option>);

  return (
    <section>
      {/* Sinais de vida das Integrações: recarrega a cada minuto com a aba visível (campos digitados continuam). */}
      <RecarregarPeriodico />
      <PageHeader
        titulo="Configurações"
        descricao={admin ? <>Usuários e permissões ficam na aba <Link href="/usuarios" className="text-brand underline underline-offset-4">Usuários</Link>.</> : undefined}
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <NavegacaoSecoes secoes={admin ? SECOES : SECOES.filter((s) => s.id !== 'teto-ia' && s.id !== 'integracoes')} />

        <div className="flex min-w-0 max-w-3xl flex-1 flex-col gap-6">
          {/* Expediente e Teto de IA são formulários separados (Parte D): o teto e os alertas são só do administrador. */}
          <FormularioAlteravel action={salvarExpediente}>
            <Secao id="expediente" titulo="Expediente" descricao="Horário e dias em que o escritório atende. Os feriados cadastrados abaixo contam como fora do expediente." escopo>
              <CardContent className="flex flex-col gap-4">
                <HorarioExpediente inicio={cfg?.horario_inicio.slice(0, 5)} fim={cfg?.horario_fim.slice(0, 5)} />
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 text-sm font-medium text-foreground">Dias úteis</legend>
                  <div className="flex flex-wrap gap-2">
                    {DIAS.map((d, i) => (
                      <label
                        key={d}
                        className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input bg-surface px-3 text-base text-foreground has-checked:border-brand has-checked:bg-brand-soft"
                      >
                        <input type="checkbox" name="dia" value={i} defaultChecked={cfg?.dias_uteis.includes(i)} aria-label={DIAS_EXTENSO[i]} className={classeCaixa} />
                        <span aria-hidden>{d}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </CardContent>
              <RodapeSalvar />
            </Secao>
          </FormularioAlteravel>

          {admin && (
            <FormularioAlteravel action={salvarTetoAlertas}>
              <Secao id="teto-ia" titulo="Teto de IA e alertas" descricao="Ao chegar no teto do mês, o agente para de responder e as conversas vão para a equipe." escopo>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    id="teto_ia_usd"
                    rotulo="Teto mensal de gasto com IA (US$)"
                    ajuda={teto ? `Gasto neste mês: ${formatarUSD(teto.gasto)} (${Math.round(teto.fracao * 100)}% do teto)${gasto?.parcial ? ', valor parcial' : ''}.` : undefined}
                  >
                    <Input name="teto_ia_usd" type="number" step="1" min="1" required defaultValue={Number(cfg?.teto_ia_usd)} className="tabular sm:w-40" />
                  </FormField>
                  <FormField id="minutos_alerta_fila" rotulo="Avisar demanda sem responsável após (minutos)">
                    <Input name="minutos_alerta_fila" type="number" step="1" min="5" required defaultValue={cfg?.minutos_alerta_fila} className="tabular sm:w-40" />
                  </FormField>
                  <FormField id="email_alertas" rotulo="E-mail para alertas">
                    <CampoEmail name="email_alertas" defaultValue={cfg?.email_alertas ?? ''} />
                  </FormField>
                  <FormField id="telefone_dono" rotulo="Seu WhatsApp (recebe avisos e o resumo diário)">
                    <Input name="telefone_dono" inputMode="tel" defaultValue={cfg?.telefone_dono ?? ''} />
                  </FormField>
                </CardContent>
                <RodapeSalvar />
              </Secao>
            </FormularioAlteravel>
          )}

          <FormularioAlteravel action={salvarPrazos}>
            <Secao id="prazos" titulo="Prazos por prioridade" descricao="Dias úteis até o prazo de cada demanda nova, contando o expediente e os feriados. 0 = no mesmo dia, até o fim do expediente.">
              <CardContent className="grid gap-4 sm:grid-cols-4">
                {([
                  ['prazo_urgente_dias', 'Urgente'], ['prazo_alta_dias', 'Alta'], ['prazo_normal_dias', 'Normal'], ['prazo_baixa_dias', 'Baixa'],
                ] as const).map(([campo, nome]) => (
                  <FormField key={campo} id={campo} rotulo={`${nome} (dias úteis)`} erro={erro === 'prazos' ? 'De 0 a 30.' : undefined}>
                    <Input name={campo} type="number" step="1" min="0" max="30" required defaultValue={cfg?.[campo]} className="tabular" />
                  </FormField>
                ))}
              </CardContent>
              <RodapeSalvar rotulo="Salvar prazos" />
            </Secao>
          </FormularioAlteravel>

          <FormularioAlteravel action={salvarMensagens}>
            <Secao id="mensagens" titulo="Mensagens automáticas" descricao="O que o agente manda sozinho ao cliente nestas situações.">
              <CardContent className="flex flex-col gap-4">
                {MENSAGENS.map((m) => (
                  <FormField key={m.chave} id={`mensagem-${m.chave}`} rotulo={m.rotulo} ajuda={m.ajuda}>
                    <Textarea name={m.chave} defaultValue={mensagens[m.chave] ?? ''} rows={2} className="min-h-16" />
                  </FormField>
                ))}
              </CardContent>
              <RodapeSalvar rotulo="Salvar mensagens" />
            </Secao>
          </FormularioAlteravel>

          <FormularioAlteravel action={salvarAvisoLogin}>
            <Secao id="aviso-login" titulo="Aviso na tela de entrada" descricao="Um recado curto que a equipe lê antes de entrar no painel.">
              <CardContent>
                <FormField id="aviso_login" rotulo="Aviso na tela de entrada" ajuda="Até 200 caracteres. Vazio não mostra nada. Nunca coloque dados de clientes." erro={erro === 'aviso_login' ? 'Até 200 caracteres.' : undefined}>
                  <Textarea name="aviso_login" maxLength={200} rows={2} defaultValue={cfg?.aviso_login ?? ''} />
                </FormField>
              </CardContent>
              <RodapeSalvar rotulo="Salvar aviso" />
            </Secao>
          </FormularioAlteravel>

          <Secao id="setores" titulo="Setores" descricao="O agente usa a descrição dos assuntos para decidir para qual setor mandar cada demanda.">
            <CardContent className="flex flex-col gap-2">
              {(setores ?? []).map((s) => (
                <FormularioAlteravel key={s.id} action={salvarSetor.bind(null, s.id)} className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center">
                  <CampoNomeUnico outros={nomesSetores.filter((n) => n !== s.nome)} mensagem="Já existe um setor com este nome." name="nome" defaultValue={s.nome} aria-label={`Nome do setor ${s.nome}`} required className="sm:w-40" />
                  <Input name="descricao_assuntos" defaultValue={s.descricao_assuntos} aria-label={`Assuntos do setor ${s.nome}`} placeholder="Assuntos deste setor" className="sm:flex-1" />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-base text-foreground">
                      <input type="checkbox" name="ativo" defaultChecked={s.ativo} className={classeCaixa} /> ativo
                    </label>
                    <IndicadorAlteracoes compacto className="ml-auto" />
                    <BotaoSalvar destacar size="sm" aria-label={`Salvar setor ${s.nome}`}>Salvar</BotaoSalvar>
                  </div>
                </FormularioAlteravel>
              ))}
              {(setores ?? []).length === 0 && <p className="text-sm text-muted">Nenhum setor ainda. Crie o primeiro abaixo.</p>}
            </CardContent>
            <CardFooter>
              <form action={salvarSetor.bind(null, null)} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <CampoNomeUnico outros={nomesSetores} mensagem="Já existe um setor com este nome." name="nome" placeholder="Novo setor" aria-label="Nome do novo setor" required className="sm:w-40" />
                <Input name="descricao_assuntos" placeholder="Assuntos deste setor" aria-label="Assuntos do novo setor" className="sm:flex-1" />
                <Button type="submit" size="sm">Criar setor</Button>
              </form>
            </CardFooter>
          </Secao>

          <Secao id="servicos" titulo="Serviços do escritório" descricao="Os serviços do contrato de cada empresa e o setor que cuida de cada um.">
            <CardContent className="flex flex-col gap-2">
              {(servicos ?? []).map((s) => (
                <FormularioAlteravel key={s.id} action={salvarServico.bind(null, s.id)} className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center">
                  <CampoNomeUnico outros={nomesServicos.filter((n) => n !== s.nome)} mensagem="Já existe um serviço com este nome." name="nome" defaultValue={s.nome} aria-label={`Nome do serviço ${s.nome}`} required className="sm:flex-1" />
                  <select name="setor_id" defaultValue={s.setor_id ?? ''} aria-label={`Setor do serviço ${s.nome}`} className={cn(classeSelect, 'sm:w-48')}>
                    <option value="">Sem setor</option>
                    {opcoesSetor}
                  </select>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-base text-foreground">
                      <input type="checkbox" name="ativo" defaultChecked={s.ativo} className={classeCaixa} /> ativo
                    </label>
                    <IndicadorAlteracoes compacto className="ml-auto" />
                    <BotaoSalvar destacar size="sm" aria-label={`Salvar serviço ${s.nome}`}>Salvar</BotaoSalvar>
                  </div>
                </FormularioAlteravel>
              ))}
              {(servicos ?? []).length === 0 && <p className="text-sm text-muted">Nenhum serviço ainda. Crie o primeiro abaixo.</p>}
            </CardContent>
            <CardFooter>
              <form action={salvarServico.bind(null, null)} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <CampoNomeUnico outros={nomesServicos} mensagem="Já existe um serviço com este nome." name="nome" placeholder="Novo serviço (ex.: Folha de pagamento)" aria-label="Nome do novo serviço" required className="sm:flex-1" />
                <select name="setor_id" aria-label="Setor do novo serviço" className={cn(classeSelect, 'sm:w-48')}>
                  <option value="">Sem setor</option>
                  {opcoesSetor}
                </select>
                <Button type="submit" size="sm">Criar serviço</Button>
              </form>
            </CardFooter>
          </Secao>

          <Secao id="respostas" titulo="Respostas prontas" descricao="O agente só responde sozinho o que estiver aqui (além de saudações e andamento de demandas).">
            <CardContent className="flex flex-col gap-2">
              {(respostas ?? []).length === 0 ? (
                <EmptyState icone={MessageSquareText} titulo="Nenhuma resposta pronta." descricao="Adicione abaixo as perguntas que o agente pode responder sozinho." className="py-6" />
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                  {(respostas ?? []).map((r) => (
                    <li key={r.id} className="flex items-start gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{r.pergunta}</p>
                        <p className="whitespace-pre-line text-muted">{r.resposta}</p>
                      </div>
                      <ConfirmDialog
                        gatilho={(
                          <Button type="button" variant="ghost" size="icon" aria-label={`Remover a resposta pronta: ${r.pergunta}`} className="size-8 text-muted hover:text-danger">
                            <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                          </Button>
                        )}
                        titulo="Remover resposta pronta?"
                        descricao={<>O agente deixa de responder sozinho a <strong className="font-medium text-foreground">{r.pergunta}</strong>.</>}
                        confirmar="Remover"
                        enviando="Removendo…"
                        acao={removerResposta.bind(null, r.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            <CardFooter>
              <form action={salvarResposta} className="flex w-full flex-col gap-2">
                <Input name="pergunta" placeholder="Pergunta (ex.: Qual o horário de atendimento?)" aria-label="Pergunta" required />
                <Textarea name="resposta" placeholder="Resposta" aria-label="Resposta" required rows={2} className="min-h-16" />
                <Button type="submit" size="sm" className="w-fit">Adicionar resposta</Button>
              </form>
            </CardFooter>
          </Secao>

          <Secao id="feriados" titulo="Feriados" descricao="Dias sem expediente.">
            <CardContent>
              {(feriados ?? []).length === 0 ? (
                <EmptyState icone={CalendarOff} titulo="Nenhum feriado cadastrado." className="py-6" />
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                  {(feriados ?? []).map((f) => {
                    const data = formatarData(`${f.data}T12:00:00-03:00`);
                    return (
                      <li key={f.data} className="flex items-center gap-3 px-3 py-2">
                        <span className="tabular w-24 shrink-0 text-muted">{data}</span>
                        <span className="min-w-0 flex-1 truncate text-foreground">{f.descricao}</span>
                        <ConfirmDialog
                          gatilho={(
                            <Button type="button" variant="ghost" size="icon" aria-label={`Remover o feriado ${data}`} className="size-8 text-muted hover:text-danger">
                              <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                            </Button>
                          )}
                          titulo="Remover feriado?"
                          descricao={`${data} · ${f.descricao} volta a ser dia normal de expediente.`}
                          confirmar="Remover"
                          enviando="Removendo…"
                          acao={removerFeriado.bind(null, f.data)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
            <CardFooter>
              <form action={adicionarFeriado} className="flex w-full flex-col gap-2 sm:flex-row">
                <Input type="date" name="data" aria-label="Data do feriado" required className="tabular sm:w-44" />
                <Input name="descricao" placeholder="Descrição" aria-label="Descrição do feriado" required className="sm:flex-1" />
                <Button type="submit" size="sm" variant="outline">Adicionar</Button>
              </form>
            </CardFooter>
          </Secao>

          {admin && (
            <Secao id="integracoes" titulo="Integrações" descricao="Último sinal de cada serviço. Sem sinal há mais de 5 minutos, algo parou.">
              <CardContent className="flex flex-col gap-2">
                <HealthSignal rotulo="WhatsApp (Z-API)" ultimoSinal={sinal('whatsapp')} limites={LIMITES_BATIMENTO} />
                {!sinal('whatsapp') && <p className="text-sm text-muted">Sem sinal do WhatsApp: verifique a Z-API.</p>}
                <HealthSignal rotulo="Trabalhador e fila de tarefas" ultimoSinal={sinal('fila')} limites={LIMITES_BATIMENTO} />
              </CardContent>
            </Secao>
          )}
        </div>
      </div>
    </section>
  );
}
