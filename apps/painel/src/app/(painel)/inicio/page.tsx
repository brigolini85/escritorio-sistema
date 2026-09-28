import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarPausaGeral, marcarAlertaLido } from './acoes';

export default async function Inicio() {
  const u = await obterUsuario();
  const sb = await supabaseServidor();
  const [{ data: abertos }, { data: alertas }, { data: cfg }] = await Promise.all([
    sb.from('chamados').select('responsavel_id, setores(nome)').neq('status', 'concluido'),
    sb.from('alertas').select('*').is('lido_em', null).order('criado_em', { ascending: false }).limit(20),
    u.papel === 'admin' ? sb.from('configuracoes').select('agente_pausado').eq('id', 1).single() : Promise.resolve({ data: null }),
  ]);
  const porSetor = new Map<string, number>();
  for (const c of abertos ?? []) porSetor.set(c.setores?.nome ?? 'Triagem', (porSetor.get(c.setores?.nome ?? 'Triagem') ?? 0) + 1);
  const semResponsavel = (abertos ?? []).filter((c) => !c.responsavel_id).length;

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Início</h1>
      {cfg && (
        <div className={`flex items-center justify-between rounded-lg p-4 ${cfg.agente_pausado ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <p>{cfg.agente_pausado ? 'O agente está PAUSADO: todas as mensagens vão para a equipe.' : 'O agente está atendendo normalmente.'}</p>
          <form action={alternarPausaGeral.bind(null, !cfg.agente_pausado)}>
            <button className="rounded bg-slate-900 px-3 py-1 text-white">{cfg.agente_pausado ? 'Retomar agente' : 'Pausar agente'}</button>
          </form>
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        {[...porSetor].map(([setor, total]) => (
          <div key={setor} className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-500">{setor}</p><p className="text-2xl font-semibold">{total}</p><p className="text-xs">chamados abertos</p></div>
        ))}
        <div className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-500">Sem responsável</p><p className="text-2xl font-semibold text-red-700">{semResponsavel}</p></div>
      </div>
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold">Alertas</h2>
        {(alertas ?? []).length === 0 && <p className="text-sm text-slate-500">Nenhum alerta.</p>}
        <ul className="space-y-1 text-sm">{(alertas ?? []).map((a) => (
          <li key={a.id} className="flex justify-between gap-2"><span className={a.nivel === 'critico' ? 'text-red-700' : ''}>{a.mensagem}</span>
            <form action={marcarAlertaLido.bind(null, a.id)}><button className="text-slate-500 underline">ok</button></form></li>
        ))}</ul>
      </section>
    </div>
  );
}
