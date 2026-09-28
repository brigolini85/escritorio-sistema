import Link from 'next/link';
import { FILTROS, filtroPadrao, passaNoFiltro, type FiltroCaixa } from '@/lib/caixa';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AtualizarAoVivo } from './atualizar-ao-vivo';

export default async function Atendimento({ searchParams }: { searchParams: Promise<{ filtro?: FiltroCaixa }> }) {
  const u = await obterUsuario();
  const filtro = (await searchParams).filtro ?? filtroPadrao(u);
  const sb = await supabaseServidor();
  // O filtro vai na consulta, antes do limite: senão conversas antigas somem de "Minhas" e "Do meu setor".
  let consulta = sb.from('caixa_entrada').select('*');
  if (filtro === 'minhas') consulta = consulta.eq('atendente_id', u.id);
  else if (filtro === 'setor') consulta = consulta.overlaps('setores_abertos', u.setores.length ? u.setores : ['00000000-0000-0000-0000-000000000000']);
  else if (filtro === 'sem_responsavel') consulta = consulta.eq('sem_responsavel', true);
  else if (filtro === 'aguardando') consulta = consulta.eq('aguardando_cliente', true);
  const { data } = await consulta.order('ultima_em', { ascending: false, nullsFirst: false }).limit(200);
  const linhas = (data ?? []).filter((l) => passaNoFiltro({
    id: l.id!, atendente_id: l.atendente_id, setores_abertos: l.setores_abertos ?? [],
    sem_responsavel: Boolean(l.sem_responsavel), aguardando_cliente: Boolean(l.aguardando_cliente),
  }, filtro, u));

  return (
    <section>
      <AtualizarAoVivo />
      <h1 className="mb-4 text-xl font-semibold">Atendimento</h1>
      <div className="mb-4 flex gap-2">
        {FILTROS.map((f) => (
          <Link key={f.valor} href={`?filtro=${f.valor}`}
            className={`rounded-full px-3 py-1 text-sm ${f.valor === filtro ? 'bg-slate-900 text-white' : 'bg-white border'}`}>{f.rotulo}</Link>
        ))}
      </div>
      {linhas.length === 0 && <p className="text-slate-500">Nenhuma conversa neste filtro.</p>}
      <ul className="divide-y rounded-lg border bg-white">
        {linhas.map((l) => (
          <li key={l.id}>
            <Link href={`/atendimento/${l.id}`} className="flex items-center justify-between p-3 hover:bg-slate-50">
              <div>
                <p className="font-medium">{l.nome_contato}{l.empresa ? ` · ${l.empresa}` : ''}</p>
                <p className="line-clamp-1 text-sm text-slate-500">{l.ultima_mensagem ?? ''}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                {l.estado === 'humano' ? <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">com atendente</span> : <span>agente</span>}
                {l.sem_responsavel && <p className="text-red-600">sem responsável</p>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
