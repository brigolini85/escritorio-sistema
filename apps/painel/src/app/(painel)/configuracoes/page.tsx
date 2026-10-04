import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes } from '@/components/patterns/formulario-alteravel';
import { HealthSignal } from '@/components/patterns/health-signal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { LIMITES_BATIMENTO, situacaoTeto } from '@/lib/inicio';
import { hojeSP } from '@/lib/configuracoes';
import { exigirConfiguracoes } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { classeCaixa, classeSelect } from '../clientes/estilos';
import { gastoDoMes } from '../inicio/gasto-do-mes';
import {
  salvarServico, salvarSetor,
} from './acoes';
import { CampoNomeUnico } from './campos-validados';
import { NavegacaoSecoes, type SecaoConfiguracao } from './navegacao-secoes';
import { SecaoEspera } from './secoes/espera';
import { SecaoExpediente } from './secoes/expediente';
import { SecaoFeriados } from './secoes/feriados';
import { SecaoIa } from './secoes/ia';
import { SecaoMensagens } from './secoes/mensagens';
import { SecaoPrazos } from './secoes/prazos';
import { SecaoRespostas } from './secoes/respostas';

const SECOES: SecaoConfiguracao[] = [
  { id: 'expediente', rotulo: 'Expediente' },
  { id: 'prazos', rotulo: 'Prazos' },
  { id: 'espera', rotulo: 'Limites de espera' },
  { id: 'teto-ia', rotulo: 'Teto de IA' },
  { id: 'mensagens', rotulo: 'Mensagens automáticas' },
  { id: 'setores', rotulo: 'Setores' },
  { id: 'servicos', rotulo: 'Serviços' },
  { id: 'respostas', rotulo: 'Respostas prontas' },
  { id: 'feriados', rotulo: 'Feriados' },
  { id: 'integracoes', rotulo: 'Integrações' },
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

export default async function Configuracoes() {
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
  if (!cfg) throw new Error('Não consegui ler as configurações.');
  const hoje = hojeSP(agora);
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
          <SecaoExpediente cfg={cfg} />

          {admin && <SecaoIa cfg={cfg} teto={teto} parcial={gasto?.parcial ?? false} />}

          <SecaoPrazos cfg={cfg} feriados={feriados ?? []} hoje={hoje} admin={admin} agora={agora} />

          <SecaoEspera cfg={cfg} />

          <SecaoMensagens cfg={cfg} />

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

          <SecaoRespostas respostas={respostas ?? []} />

          <SecaoFeriados feriados={feriados ?? []} hoje={hoje} />

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
