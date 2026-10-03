import { Bell } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { AgentStateIndicator } from '@/components/patterns/agent-state-indicator';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { EmptyState } from '@/components/patterns/empty-state';
import { estadoGeralDoAgente } from '@/components/patterns/estado-agente';
import { HealthSignal } from '@/components/patterns/health-signal';
import { RelativeTime } from '@/components/patterns/relative-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { contarConversasAguardando, contarDemandasAbertas } from '@/lib/contadores';
import { lerFiltrosDemandas } from '@/lib/demandas';
import { filtrarConsulta } from '@/lib/demandas-consulta';
import { formatarUSD } from '@/lib/formatos';
import { LIMITES_BATIMENTO, lerSinaisVida, MINUTOS_SEM_RESPONSAVEL_PADRAO, situacaoTeto } from '@/lib/inicio';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { alternarPausaGeral, marcarAlertaLido } from './acoes';
import { FaixaAlertas } from './faixa-alertas';
import { gastoDoMes } from './gasto-do-mes';

const NIVEL_AVISO: Record<string, { rotulo: string; variant: 'danger' | 'warning' | 'info' }> = {
  critico: { rotulo: 'Crítico', variant: 'danger' },
  operacional: { rotulo: 'Operacional', variant: 'warning' },
  aviso: { rotulo: 'Aviso', variant: 'info' },
};

/**
 * Início: painel de situação. Em ordem: faixa de alertas (só com algo errado), agente, sinais de vida, números do dia
 * e avisos. Configurações, sinais de vida e gasto de IA só o administrador lê (RLS): para as outras pessoas esses
 * cartões não aparecem. A página recarrega sozinha: pelo tempo real (AtualizarAoVivo, conversas e demandas) e a
 * cada minuto com a aba visível (RecarregarPeriodico), para sinais de vida, alertas e números não ficarem velhos.
 */
export default async function Inicio() {
  const u = await obterUsuario();
  const admin = u.papel === 'admin';
  const sb = await supabaseServidor();
  const agora = new Date();

  const [{ data: alertas }, { data: cfg }, { data: setores }, aguardando, abertas, gasto, sinais] = await Promise.all([
    sb.from('alertas').select('*').is('lido_em', null).order('criado_em', { ascending: false }).limit(20),
    admin ? sb.from('configuracoes').select('agente_pausado, teto_ia_usd, minutos_alerta_fila').eq('id', 1).single() : Promise.resolve({ data: null }),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    contarConversasAguardando(sb),
    contarDemandasAbertas(sb),
    admin ? gastoDoMes(sb, u.id, agora) : Promise.resolve(null),
    admin ? lerSinaisVida(sb) : Promise.resolve(null),
  ]);

  // "Há muito tempo" = o mesmo prazo do alerta de fila das Configurações (minutos_alerta_fila); sem leitura, o padrão do banco.
  const minutos = cfg?.minutos_alerta_fila ?? MINUTOS_SEM_RESPONSAVEL_PADRAO;
  const limite = new Date(agora.getTime() - minutos * 60_000).toISOString();
  const abertasSemResponsavel = () => sb.from('chamados').select('id', { count: 'exact', head: true }).neq('status', 'concluido').is('responsavel_id', null);
  const porSetor = (setorId: string | null) => {
    const q = sb.from('chamados').select('id', { count: 'exact', head: true }).neq('status', 'concluido');
    return setorId ? q.eq('setor_id', setorId) : q.is('setor_id', null);
  };
  const contarDemandas = (params: Record<string, string>) =>
    filtrarConsulta(sb.from('demandas_lista').select('id', { count: 'exact', head: true }), lerFiltrosDemandas(params, u.id), u.id, agora);
  const [vencemHoje, vencidas, semResp, semRespAntigas, ...contagens] = await Promise.all([
    contarDemandas({ prazo: 'hoje' }),
    contarDemandas({ vencidas: '1' }),
    abertasSemResponsavel(),
    abertasSemResponsavel().lt('criado_em', limite),
    ...(setores ?? []).map((s) => porSetor(s.id)),
    porSetor(null),
  ]);
  // Contagem por setor: o RLS zera os setores que a pessoa não atende, e setor zerado não aparece.
  const linhasSetor = [...(setores ?? []).map((s) => ({ id: s.id, nome: s.nome })), { id: 'triagem', nome: 'Triagem' }]
    .map((s, i) => ({ ...s, total: contagens[i]?.count ?? 0 }))
    .filter((s) => s.total > 0);

  const teto = cfg && gasto ? situacaoTeto(gasto.total, Number(cfg.teto_ia_usd)) : null;
  const estado = estadoGeralDoAgente(cfg?.agente_pausado ?? null, teto ? teto.nivel === 'atingido' : null);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <AtualizarAoVivo />
      <RecarregarPeriodico />
      <PageHeader titulo="Início" descricao="Como está o atendimento agora." className="mb-0" />

      <FaixaAlertas teto={teto} sinais={sinais} />

      {(cfg || sinais) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {cfg && estado && (
            <Card>
              <CardHeader>
                <CardTitle>Agente</CardTitle>
                <CardDescription>O robô que responde os clientes no WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <AgentStateIndicator estado={estado} variante="completo" />
                <p className="text-sm text-foreground">
                  {cfg.agente_pausado
                    ? 'O agente está PAUSADO: todas as mensagens vão para a equipe.'
                    : estado.tipo === 'pausado'
                      ? 'O agente não está respondendo: o gasto com IA do mês chegou ao teto e as mensagens vão para a equipe. O assistente da equipe também para até o mês virar ou o teto subir.'
                      : 'O agente está atendendo normalmente.'}
                </p>
                <div>
                  <ConfirmDialog
                    key={String(cfg.agente_pausado)}
                    acao={alternarPausaGeral.bind(null, !cfg.agente_pausado)}
                    gatilho={<Button variant={cfg.agente_pausado ? 'primary' : 'outline'} size="sm">{cfg.agente_pausado ? 'Retomar agente' : 'Pausar agente'}</Button>}
                    titulo={cfg.agente_pausado ? 'Retomar o agente?' : 'Pausar o agente?'}
                    descricao={cfg.agente_pausado
                      ? 'O agente volta a responder os clientes no WhatsApp.'
                      : 'O agente para de responder todos os clientes. As mensagens novas vão para a equipe atender no painel.'}
                    confirmar={cfg.agente_pausado ? 'Retomar agente' : 'Pausar agente'}
                    enviando={cfg.agente_pausado ? 'Retomando…' : 'Pausando…'}
                    variante={cfg.agente_pausado ? 'primary' : 'danger'}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {sinais && (
            <Card>
              <CardHeader>
                <CardTitle>Sinais de vida</CardTitle>
                <CardDescription>O trabalhador bate a cada minuto; o WhatsApp só conta quando a Z-API responde conectada.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <HealthSignal rotulo="WhatsApp (Z-API)" ultimoSinal={sinais.whatsapp} limites={LIMITES_BATIMENTO} />
                <HealthSignal rotulo="Fila de tarefas (pg-boss)" ultimoSinal={sinais.fila} limites={LIMITES_BATIMENTO} />
                <p className="text-sm text-muted">
                  Último batimento: {sinais.ultimo ? <RelativeTime data={sinais.ultimo} focavel className="text-foreground" /> : <span className="text-danger">nenhum registrado</span>}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <section aria-labelledby="numeros-do-dia" className="flex flex-col gap-3">
        <h2 id="numeros-do-dia" className="text-lg font-semibold text-foreground">Números do dia</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Numero
            titulo="Conversas aguardando humano"
            valor={aguardando}
            destaque={(aguardando ?? 0) > 0 ? 'atencao' : undefined}
            rodape={<Link href="/atendimento?filtro=sem_responsavel" className="text-brand underline-offset-4 hover:underline">Ver no Atendimento</Link>}
          />
          <Numero titulo="Demandas abertas" valor={abertas}>
            {linhasSetor.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {linhasSetor.map((s) => (
                  <li key={s.id}>
                    <Link href={`/demandas?setor=${s.id}`} className="flex items-center justify-between gap-2 rounded-sm text-foreground hover:underline">
                      <span className="truncate">{s.nome}</span>
                      <span className="tabular text-muted">{s.total}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Numero>
          <Numero
            titulo="Sem responsável"
            valor={semResp.error ? null : semResp.count ?? 0}
            destaque={(semRespAntigas.count ?? 0) > 0 ? 'perigo' : undefined}
            rodape={(
              <span className={cn((semRespAntigas.count ?? 0) > 0 ? 'text-danger' : 'text-muted')}>
                {semRespAntigas.count ?? 0} há mais de {minutos} min ·{' '}
                <Link href="/demandas?responsavel=sem" className="text-brand underline-offset-4 hover:underline">Ver na lista</Link>
              </span>
            )}
          />
          <Numero
            titulo="Vencem hoje"
            valor={vencemHoje.error ? null : vencemHoje.count ?? 0}
            destaque={(vencemHoje.count ?? 0) > 0 ? 'atencao' : undefined}
            rodape={<Link href="/demandas?prazo=hoje" className="text-brand underline-offset-4 hover:underline">Ver na lista</Link>}
          />
          <Numero
            titulo="Vencidas"
            valor={vencidas.error ? null : vencidas.count ?? 0}
            destaque={(vencidas.count ?? 0) > 0 ? 'perigo' : undefined}
            rodape={<Link href="/demandas?vencidas=1" className="text-brand underline-offset-4 hover:underline">Ver na lista</Link>}
          />
          {teto && <GastoIa gasto={teto.gasto} teto={teto.teto} fracao={teto.fracao} nivel={teto.nivel} parcial={gasto?.parcial ?? false} />}
        </div>
      </section>

      <section aria-labelledby="avisos" className="flex flex-col gap-3">
        <h2 id="avisos" className="text-lg font-semibold text-foreground">Avisos</h2>
        <Card>
          {(alertas ?? []).length === 0 ? (
            <EmptyState icone={Bell} titulo="Nenhum aviso." descricao="Os avisos do agente e do sistema aparecem aqui." className="py-6" />
          ) : (
            <ul className="divide-y divide-border">
              {(alertas ?? []).map((a) => {
                const nivel = NIVEL_AVISO[a.nivel] ?? NIVEL_AVISO.aviso!;
                return (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <Badge variant={nivel.variant} className="mt-0.5">{nivel.rotulo}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-foreground', a.nivel === 'critico' && 'font-medium')}>{a.mensagem}</p>
                      <RelativeTime data={a.criado_em} className="text-xs text-muted" />
                    </div>
                    <form action={marcarAlertaLido.bind(null, a.id)}>
                      <Button type="submit" variant="ghost" size="sm" title="Marcar como visto">ok</Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function Numero({ titulo, valor, destaque, rodape, children }: {
  titulo: string; valor: number | null; destaque?: 'atencao' | 'perigo'; rodape?: ReactNode; children?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{titulo}</p>
      <p className={cn('tabular text-2xl font-semibold', destaque === 'perigo' ? 'text-danger' : destaque === 'atencao' ? 'text-warning' : 'text-foreground')}>
        {valor ?? '—'}
      </p>
      {children}
      {rodape && <div className="mt-auto pt-2 text-xs">{rodape}</div>}
    </Card>
  );
}

function GastoIa({ gasto, teto, fracao, nivel, parcial }: { gasto: number; teto: number; fracao: number; nivel: 'ok' | 'perto' | 'atingido'; parcial: boolean }) {
  const pct = Math.min(100, Math.round(fracao * 100));
  const cor = nivel === 'atingido' ? 'bg-danger' : nivel === 'perto' ? 'bg-warning' : 'bg-brand';
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">Gasto com IA no mês</p>
      <p className="tabular text-2xl font-semibold text-foreground">{formatarUSD(gasto)}</p>
      <div
        role="progressbar"
        aria-label="Gasto com IA do mês em relação ao teto"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% do teto`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className={cn('h-full rounded-full transition-all duration-150 ease-out', cor)} style={{ width: `${pct}%` }} />
      </div>
      <p className={cn('mt-auto pt-2 text-xs', nivel === 'atingido' ? 'text-danger' : nivel === 'perto' ? 'text-warning' : 'text-muted')}>
        {pct}% do teto de {formatarUSD(teto)}{parcial && ' · valor parcial (mês com uso demais para somar aqui; o real é maior)'}
      </p>
    </Card>
  );
}
