import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { Database } from '@escritorio/db';
import { salvarCliente, salvarResponsaveis, salvarServicos } from '../acoes';

type Cliente = Database['public']['Tables']['clientes']['Row'];

export async function SecaoDados({ id, u, pode, c }: { id: string; u: UsuarioPainel; pode: boolean; c: Cliente }) {
  const sb = await supabaseServidor();
  const [{ data: servicos }, { data: contratados }, { data: setores }, { data: usuarios }, { data: resp }] = await Promise.all([
    sb.from('servicos').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('cliente_servicos').select('servico_id').eq('cliente_id', id),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('cliente_responsaveis').select('setor_id, usuario_id').eq('cliente_id', id),
  ]);
  const marcados = new Set((contratados ?? []).map((s) => s.servico_id));
  const campo = 'mt-1 w-full rounded border p-2 disabled:bg-slate-50';
  return (
    <div className="space-y-6">
      <form action={salvarCliente.bind(null, id)} className="grid grid-cols-2 gap-3 rounded-lg border bg-white p-4">
        <h2 className="col-span-2 font-semibold">Dados</h2>
        <fieldset disabled={!pode} className="contents">
          <label className="text-sm">Razão social<input name="razao_social" defaultValue={c.razao_social} className={campo} /></label>
          <label className="text-sm">Nome fantasia<input name="nome_fantasia" defaultValue={c.nome_fantasia ?? ''} className={campo} /></label>
          <label className="text-sm">CNPJ<input name="cnpj" defaultValue={c.cnpj} className={campo} /></label>
          <label className="text-sm">Inscrição estadual<input name="inscricao_estadual" defaultValue={c.inscricao_estadual ?? ''} className={campo} /></label>
          <label className="text-sm">Regime<input name="regime" defaultValue={c.regime ?? ''} className={campo} /></label>
          <label className="text-sm">UF<input name="uf" defaultValue={c.uf ?? ''} maxLength={2} className={campo} /></label>
          <label className="col-span-2 text-sm">Endereço<input name="endereco" defaultValue={c.endereco ?? ''} className={campo} /></label>
          {u.papel === 'admin' && <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="agente_pausado" defaultChecked={c.agente_pausado} /> Pausar o agente para este cliente</label>}
          {pode && <button className="col-span-2 w-fit rounded bg-slate-900 px-4 py-2 text-white">Salvar dados</button>}
        </fieldset>
      </form>
      <form action={salvarServicos.bind(null, id)} className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold">Serviços do contrato</h2>
        <fieldset disabled={!pode} className="grid grid-cols-2 gap-1 text-sm">
          {(servicos ?? []).map((s) => (
            <label key={s.id} className="flex items-center gap-2"><input type="checkbox" name="servico" value={s.id} defaultChecked={marcados.has(s.id)} /> {s.nome}</label>
          ))}
        </fieldset>
        {pode && <button className="mt-3 rounded bg-slate-900 px-4 py-2 text-white">Salvar serviços</button>}
      </form>
      <form action={salvarResponsaveis.bind(null, id)} className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold">Responsável por setor</h2>
        <fieldset disabled={!pode} className="grid grid-cols-2 gap-2 text-sm">
          {(setores ?? []).map((s) => (
            <label key={s.id}>{s.nome}
              <select name={`setor:${s.id}`} defaultValue={resp?.find((r) => r.setor_id === s.id)?.usuario_id ?? ''} className="mt-1 block w-full rounded border p-2">
                <option value="">Fila do setor</option>
                {(usuarios ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
          ))}
        </fieldset>
        {pode && <button className="mt-3 rounded bg-slate-900 px-4 py-2 text-white">Salvar responsáveis</button>}
      </form>
    </div>
  );
}
