import Link from 'next/link';
import { CircleDollarSign } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerPeriodo } from '@/lib/gastos';
import { formatarBRL } from '@/lib/formatos';
import { FiltrosPeriodo } from './filtros-periodo';
import { Cartoes, lerResumo } from './cartoes';
import { PorFuncionalidade } from './por-funcionalidade';
import { PorDia } from './por-dia';

const LINK = 'text-brand underline-offset-4 hover:underline';

/** Gastos com IA (spec 7B.3): só o administrador (spec 7; o banco recusa os outros). */
export default async function GastosIa({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string }> }) {
  await exigirAdmin();
  const agora = new Date();
  const periodo = lerPeriodo(await searchParams, agora);
  const mes = lerPeriodo({}, agora);
  const sb = await supabaseServidor();
  const intervalo = { p_de: periodo.de, p_ate: periodo.ate };
  const [resumo, resumoMes, porFuncionalidade, porDia, diaMaisCaro, { data: cfg }] = await Promise.all([
    sb.rpc('gastos_resumo', intervalo),
    periodo.filtro === 'mes' ? Promise.resolve(null) : sb.rpc('gastos_resumo', { p_de: mes.de, p_ate: mes.ate }),
    sb.rpc('gastos_por_funcionalidade', intervalo),
    sb.rpc('gastos_por_dia', intervalo),
    sb.rpc('gastos_dia_mais_caro', intervalo),
    sb.from('configuracoes').select('teto_ia_usd, cotacao_usd_brl, custo_minuto_transcricao_usd').eq('id', 1).single(),
  ]);
  // Erro de leitura lança: o error.tsx do grupo mostra a falha, sem tela pela metade.
  for (const r of [resumo, resumoMes, porFuncionalidade, porDia, diaMaisCaro]) if (r?.error) throw new Error(r.error.message);
  const cotacao = cfg?.cotacao_usd_brl ? Number(cfg.cotacao_usd_brl) : null;
  const resumoPeriodo = lerResumo(resumo.data);

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
      {/* Task 9: RankingEquipe, GastosPorCliente e o DetalhePessoa entram aqui. */}
    </section>
  );
}
