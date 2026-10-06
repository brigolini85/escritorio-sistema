import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { souDono } from '@/lib/agentes';
import { lerFiltroRadar, lerTelaRadar } from '@/lib/radar';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { ParamsBusca } from '@/lib/tabela-url';
import { CabecalhoRadar } from './cabecalho-radar';
import { FaixaGiro } from './faixa-giro';
import { FiltrosNovidades } from './filtros-novidades';
import { Novidades, type SlotsNovidade } from './novidades';

/**
 * Visão geral do Radar (D18). A coluna da direita (Fontes, Assuntos, Regras, Avisos, Últimos giros) e as janelas
 * (agenda, giros anteriores, ver lista, mandar para clientes) entram pelos slots da Task 10.
 */
export async function TelaRadar({ searchParams, lateral, botaoAgenda, botaoGiros, slots }: {
  searchParams: Promise<ParamsBusca>; lateral?: ReactNode; botaoAgenda?: ReactNode; botaoGiros?: ReactNode; slots?: SlotsNovidade;
}) {
  const [sp, u] = await Promise.all([searchParams, obterUsuario()]);
  const sb = await supabaseServidor();
  const agora = new Date();
  const filtro = lerFiltroRadar(sp);
  const [tela, dono, conf] = await Promise.all([
    lerTelaRadar(sb, filtro, agora), souDono(sb), sb.from('configuracoes').select('cotacao_usd_brl').eq('id', 1).maybeSingle(),
  ]);
  if (tela.semI5) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">
        <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
        O Radar aparece quando a atualização do banco da Parte I5 for aplicada.
      </p>
    );
  }
  const cotacao = conf.data?.cotacao_usd_brl ? Number(conf.data.cotacao_usd_brl) : null;
  // A novidade guarda só o código da pessoa que decidiu; o nome vem da lista de usuários.
  const ids = [...new Set(tela.novidades.map((n) => n.decididaPor).filter((x): x is string => !!x))];
  const { data: pessoas } = ids.length ? await sb.from('usuarios').select('id, nome').in('id', ids) : { data: [] };
  const nomes = Object.fromEntries((pessoas ?? []).map((p) => [p.id, p.nome]));
  const agoraIso = agora.toISOString();
  const admin = u.papel === 'admin';
  return (
    <div className="flex flex-col gap-4">
      {tela.erro && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
          <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
          <span><b>Erro.</b> Não consegui ler tudo do Radar agora. Recarregue a página.</span>
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <CabecalhoRadar tela={tela} dono={dono} admin={admin} cotacao={cotacao} agoraIso={agoraIso} botaoAgenda={botaoAgenda} botaoGiros={botaoGiros} />
          <FaixaGiro giro={tela.giros[0] ?? null} agoraIso={agoraIso} />
          <section aria-label="Novidades" className="flex flex-col gap-3">
            <FiltrosNovidades filtro={filtro} contagem={tela.contagem} setores={tela.setores} />
            <Novidades novidades={tela.novidades} estado={filtro.estado} total={tela.contagem[filtro.estado]} nomes={nomes} agoraIso={agoraIso} dono={dono} admin={admin} slots={slots} />
          </section>
        </div>
        {lateral && <div className="flex min-w-0 flex-col gap-4">{lateral}</div>}
      </div>
    </div>
  );
}
