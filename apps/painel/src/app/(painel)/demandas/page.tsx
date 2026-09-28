import Link from 'next/link';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';

const STATUS: Record<string, string> = {
  aberto: 'Aberta',
  em_andamento: 'Em andamento',
  aguardando_cliente: 'Aguardando cliente',
  concluido: 'Concluída',
};

const hora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

/** Demandas abertas pelo agente ou pela equipe. O RLS já limita cada pessoa aos setores dela. */
export default async function Demandas({ searchParams }: { searchParams: Promise<{ setor?: string }> }) {
  await obterUsuario();
  const setor = (await searchParams).setor ?? 'todos';
  const sb = await supabaseServidor();
  const { data: setores } = await sb.from('setores').select('id, nome').eq('ativo', true).order('nome');
  let consulta = sb.from('chamados')
    .select('id, numero, titulo, resumo, status, criado_em, conversa_id, fora_do_contrato, setores(nome), clientes(razao_social, nome_fantasia), usuarios(nome)')
    .neq('status', 'concluido').order('criado_em', { ascending: false }).limit(200);
  if (setor === 'triagem') consulta = consulta.is('setor_id', null);
  else if (setor !== 'todos') consulta = consulta.eq('setor_id', setor);
  const { data: demandas } = await consulta;

  const filtros = [{ valor: 'todos', rotulo: 'Todos' }, ...(setores ?? []).map((s) => ({ valor: s.id, rotulo: s.nome })), { valor: 'triagem', rotulo: 'Triagem' }];

  return (
    <section>
      <AtualizarAoVivo />
      <h1 className="mb-4 text-xl font-semibold">Demandas</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <Link key={f.valor} href={`?setor=${f.valor}`}
            className={`rounded-full px-3 py-1 text-sm ${f.valor === setor ? 'bg-slate-900 text-white' : 'border bg-white'}`}>{f.rotulo}</Link>
        ))}
      </div>
      {(demandas ?? []).length === 0 && <p className="text-slate-500">Nenhuma demanda aberta neste filtro.</p>}
      <ul className="space-y-3">
        {(demandas ?? []).map((d) => (
          <li key={d.id} className="rounded-lg border bg-white p-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">#{d.numero} · {d.titulo}</p>
                <p className="text-slate-500">
                  {d.setores?.nome ?? 'Triagem'} · {d.clientes?.nome_fantasia ?? d.clientes?.razao_social ?? 'Cliente não identificado'}
                  {' · '}{STATUS[d.status] ?? d.status}{d.fora_do_contrato ? ' · fora do contrato' : ''}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                <p>{hora(d.criado_em)}</p>
                <p className={d.usuarios?.nome ? '' : 'text-red-600'}>{d.usuarios?.nome ?? 'sem responsável'}</p>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap">{d.resumo}</p>
            {d.conversa_id && <Link href={`/atendimento/${d.conversa_id}`} className="mt-2 inline-block text-blue-700 underline">Abrir conversa</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}
