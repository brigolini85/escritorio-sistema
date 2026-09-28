import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarProduto } from '../cadastros-acoes';

const input = 'rounded border p-2 text-sm disabled:bg-slate-50';

export async function SecaoProdutos({ id, pode }: { id: string; pode: boolean }) {
  const sb = await supabaseServidor();
  const { data: produtos } = await sb.from('produtos').select('*').eq('cliente_id', id).order('descricao');
  return (
    <div className="space-y-2 rounded-lg border bg-white p-4">
      {(produtos ?? []).length === 0 && <p className="text-sm text-slate-500">Nenhum produto cadastrado.</p>}
      {(produtos ?? []).map((p) => (
        <form key={p.id} action={salvarProduto.bind(null, id, p.id)} className={`grid grid-cols-[6rem_1fr_6rem_1fr_auto_auto] items-center gap-2 ${p.ativo ? '' : 'opacity-60'}`}>
          <fieldset disabled={!pode} className="contents">
            <input name="codigo" defaultValue={p.codigo} className={input} aria-label={`Código de ${p.codigo}`} />
            <input name="descricao" defaultValue={p.descricao} className={input} aria-label={`Descrição de ${p.codigo}`} />
            <input name="unidade" defaultValue={p.unidade} className={input} aria-label={`Unidade de ${p.codigo}`} />
            <input name="apelidos" defaultValue={p.apelidos.join(', ')} className={input} aria-label={`Apelidos de ${p.codigo}`} />
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="ativo" defaultChecked={p.ativo} /> Ativo</label>
            {pode ? <button className="rounded border px-3 py-1 text-sm">Salvar</button> : <span />}
          </fieldset>
        </form>
      ))}
      {pode && (
        <form action={salvarProduto.bind(null, id, null)} className="grid grid-cols-[6rem_1fr_6rem_1fr_auto] gap-2 border-t pt-3">
          <input name="codigo" placeholder="Código" required className={input} />
          <input name="descricao" placeholder="Descrição" required className={input} />
          <input name="unidade" placeholder="Unidade (PAC, KG…)" className={input} />
          <input name="apelidos" placeholder="Apelidos, separados por vírgula" className={input} />
          <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white">Adicionar produto</button>
        </form>
      )}
    </div>
  );
}
