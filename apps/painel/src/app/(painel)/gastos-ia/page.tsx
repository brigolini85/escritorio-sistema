import Link from 'next/link';
import { Suspense } from 'react';
import { CircleDollarSign } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PainelLateralUrl } from '@/components/patterns/painel-lateral-url';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerEmpresaAberta, lerPeriodo, lerPessoaAberta } from '@/lib/gastos';
import { formatarBRL } from '@/lib/formatos';
import { hrefComParams, valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { FiltrosPeriodo } from './filtros-periodo';
import { Cartoes, lerResumo } from './cartoes';
import { PorFuncionalidade } from './por-funcionalidade';
import { PorDia } from './por-dia';
import { RankingEquipe } from './ranking-equipe';
import { DetalhePessoa, EsqueletoPessoa } from './detalhe-pessoa';
import { GastosPorCliente } from './gastos-por-cliente';

const LINK = 'text-brand underline-offset-4 hover:underline';

/** Gastos com IA (spec 7B.3): só o administrador (spec 7; o banco recusa os outros). */
export default async function GastosIa({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  await exigirAdmin();
  const params = await searchParams;
  const agora = new Date();
  const periodo = lerPeriodo({ p: valorParam(params, 'p'), de: valorParam(params, 'de'), ate: valorParam(params, 'ate') }, agora);
  const mes = lerPeriodo({}, agora);
  // Parâmetros validados antes de chegar às funções do banco: lixo é ignorado.
  const pessoa = lerPessoaAberta(params.pessoa);
  const empresa = lerEmpresaAberta(params.empresa);
  const busca = (valorParam(params, 'busca') ?? '').trim().slice(0, 100);
  const sb = await supabaseServidor();
  const intervalo = { p_de: periodo.de, p_ate: periodo.ate };
  const [resumo, resumoMes, porFuncionalidade, porDia, diaMaisCaro, porPessoa, porCliente, atendimentos, { data: cfg }] = await Promise.all([
    sb.rpc('gastos_resumo', intervalo),
    periodo.filtro === 'mes' ? Promise.resolve(null) : sb.rpc('gastos_resumo', { p_de: mes.de, p_ate: mes.ate }),
    sb.rpc('gastos_por_funcionalidade', intervalo),
    sb.rpc('gastos_por_dia', intervalo),
    sb.rpc('gastos_dia_mais_caro', intervalo),
    sb.rpc('gastos_por_pessoa', intervalo),
    sb.rpc('gastos_por_cliente', { ...intervalo, p_busca: busca || undefined }),
    // "sem" = Sem empresa identificada: a função compara com `is not distinct from`, então vai nulo.
    empresa ? sb.rpc('gastos_atendimentos_do_cliente', { ...intervalo, p_cliente: (empresa === 'sem' ? null : empresa) as string }) : Promise.resolve(null),
    sb.from('configuracoes').select('teto_ia_usd, cotacao_usd_brl, custo_minuto_transcricao_usd').eq('id', 1).single(),
  ]);
  // Erro de leitura lança: o error.tsx do grupo mostra a falha, sem tela pela metade.
  for (const r of [resumo, resumoMes, porFuncionalidade, porDia, diaMaisCaro, porPessoa, porCliente, atendimentos]) if (r?.error) throw new Error(r.error.message);
  const cotacao = cfg?.cotacao_usd_brl ? Number(cfg.cotacao_usd_brl) : null;
  const resumoPeriodo = lerResumo(resumo.data);
  // Exportar só desta pessoa (Task 10): o mesmo período, sem os demais parâmetros da tela.
  const doPeriodo: ParamsBusca = { p: valorParam(params, 'p'), de: valorParam(params, 'de'), ate: valorParam(params, 'ate') };

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        titulo={<span className="font-extrabold">Gastos com IA · <span className="text-brand">{periodo.rotulo}</span></span>}
        descricao={
          <span className="text-sm text-subtle">
            <CircleDollarSign aria-hidden size={14} strokeWidth={1.75} className="mr-1 inline align-text-bottom" />Só administrador ·{' '}
            {cotacao
              ? <>cotação usada: {formatarBRL(cotacao)} (<Link className={LINK} href="/configuracoes#teto-ia">Configurações</Link>)</>
              : <>sem cotação: valores em US$ (<Link className={LINK} href="/configuracoes#teto-ia">preencher</Link>)</>}
          </span>
        }
        acoes={<FiltrosPeriodo periodo={periodo} />}
      />
      {periodo.aviso && <p role="status" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-foreground">{periodo.aviso}</p>}
      <Cartoes
        periodo={periodo} resumo={resumoPeriodo} resumoMes={resumoMes ? lerResumo(resumoMes.data) : resumoPeriodo}
        teto={Number(cfg?.teto_ia_usd ?? 0) || 0} cotacao={cotacao} custoMinutoConfigurado={cfg?.custo_minuto_transcricao_usd != null} agora={agora}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <PorFuncionalidade linhas={porFuncionalidade.data ?? []} />
        <PorDia dias={porDia.data ?? []} hoje={lerPeriodo({ p: 'hoje' }, agora).deDia} diaMaisCaro={diaMaisCaro.data?.[0] ?? null} />
      </div>
      <RankingEquipe linhas={porPessoa.data ?? []} params={params} />
      <GastosPorCliente linhas={porCliente.data ?? []} params={params} busca={busca} aberta={empresa} atendimentos={atendimentos?.data ?? []} />
      <PainelLateralUrl param="pessoa" id={pessoa} hrefFechar={`/gastos-ia${hrefComParams(params, { pessoa: null })}`} esqueleto={<EsqueletoPessoa />}>
        {pessoa && (
          <Suspense key={`${pessoa}-${periodo.de}-${periodo.ate}`} fallback={<EsqueletoPessoa />}>
            <DetalhePessoa pessoa={pessoa} periodo={periodo} hrefExportar={`/gastos-ia/exportar${hrefComParams(doPeriodo, { pessoa })}`} />
          </Suspense>
        )}
      </PainelLateralUrl>
    </section>
  );
}
