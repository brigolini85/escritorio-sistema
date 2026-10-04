import { Bell } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { EmptyState } from '@/components/patterns/empty-state';
import { RelativeTime } from '@/components/patterns/relative-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { contarConversasAguardando, contarDemandasAbertas } from '@/lib/contadores';
import { lerFiltrosDemandas } from '@/lib/demandas';
import { filtrarConsulta } from '@/lib/demandas-consulta';
import { MINUTOS_SEM_RESPONSAVEL_PADRAO, situacaoTeto } from '@/lib/inicio';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { marcarAlertaLido } from './acoes';
import { AtualizadoHa } from './atualizado-ha';
import { CartaoAgente } from './cartao-agente';
import { CartaoGasto } from './cartao-gasto';
import { CartaoSinais } from './cartao-sinais';
import { paginaInicio } from './dados-inicio';
import { lerConfigSituacao, lerGastoSituacao, lerSinaisSituacao } from './dados-situacao';
import { FaixaAlertas } from './faixa-alertas';

const NIVEL_AVISO: Record<string, { rotulo: string; variant: 'danger' | 'warning' | 'info' }> = {
  critico: { rotulo: 'Crítico', variant: 'danger' },
  operacional: { rotulo: 'Operacional', variant: 'warning' },
  aviso: { rotulo: 'Aviso', variant: 'info' },
};

/** Início do administrador (Painel de situação). As Tasks 4 a 6 trocam cada pedaço pelo da imagem A. */
export async function PainelSituacao({ u }: { u: UsuarioPainel }) {
  const { sb, agora } = await paginaInicio();

  const [{ data: alertas }, cfg, { data: setores }, aguardando, abertas, gasto, sinais] = await Promise.all([
    sb.from('alertas').select('*').is('lido_em', null).order('criado_em', { ascending: false }).limit(20),
    lerConfigSituacao(),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    contarConversasAguardando(sb),
    contarDemandasAbertas(sb),
    lerGastoSituacao(u.id),
    lerSinaisSituacao(),
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

  return (
    <div data-inicio="situacao" className="flex max-w-7xl flex-col gap-6">
      <AtualizarAoVivo />
      <RecarregarPeriodico />
      <PageHeader titulo="Início" descricao="Como está o atendimento agora." className="mb-0" />
      <AtualizadoHa em={agora.toISOString()} />

      <FaixaAlertas teto={teto} sinais={sinais} />

      <div className="grid gap-4 lg:grid-cols-3">
        <CartaoAgente u={u} />
        <CartaoSinais />
        <CartaoGasto u={u} />
      </div>

      <section aria-labelledby="numeros-do-dia" className="flex flex-col gap-3">
        <h2 id="numeros-do-dia" className="text-lg font-semibold text-foreground">Números do dia</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Numero
            titulo="Esperando você"
            valor={aguardando}
            destaque={(aguardando ?? 0) > 0 ? 'atencao' : undefined}
            // "Atendimento: Sem acesso" (Parte D): a tela não abre, então o atalho não aparece.
            rodape={temNivel(u, 'atendimento', 'meus_setores')
              ? <Link href="/atendimento" className="text-brand underline-offset-4 hover:underline">Ver no Atendimento</Link>
              : undefined}
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
