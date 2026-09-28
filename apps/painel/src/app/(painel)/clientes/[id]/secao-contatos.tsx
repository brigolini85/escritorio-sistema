import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { adicionarContato, anonimizarContato, removerContato } from '../acoes';

export async function SecaoContatos({ id, u, pode }: { id: string; u: UsuarioPainel; pode: boolean }) {
  const sb = await supabaseServidor();
  const { data: vinculos } = await sb.from('contato_clientes')
    .select('pode_pedir_nota, pode_atualizar_preco, contatos(id, nome, telefone)').eq('cliente_id', id);
  return (
    <>
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold">Contatos autorizados no WhatsApp</h2>
        <ul className="mb-3 divide-y text-sm">
          {(vinculos ?? []).map((v) => v.contatos && (
            <li key={v.contatos.id} className="flex items-center justify-between py-2">
              <span>{v.contatos.nome} · {v.contatos.telefone}{v.pode_pedir_nota ? ' · pode pedir nota' : ''}{v.pode_atualizar_preco ? ' · pode mudar preço' : ''}</span>
              <div className="flex items-center gap-3">
                {pode && <form action={removerContato.bind(null, id, v.contatos.id)}><button className="text-red-700 underline">Remover</button></form>}
                {u.papel === 'admin' && (
                  <form action={anonimizarContato.bind(null, id, v.contatos.id)} className="flex items-center gap-1 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" name="confirmo" /> confirmo</label>
                    <button className="text-red-700 underline">Apagar dados (LGPD)</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
        {pode && (
          <form action={adicionarContato.bind(null, id)} className="flex flex-wrap items-end gap-2 text-sm">
            <label>Nome<input name="nome" required className="mt-1 block rounded border p-2" /></label>
            <label>Telefone<input name="telefone" required placeholder="(31) 99999-0000" className="mt-1 block rounded border p-2" /></label>
            <label className="flex items-center gap-1"><input type="checkbox" name="pode_pedir_nota" /> Pode pedir nota</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="pode_atualizar_preco" /> Pode mudar preço</label>
            <button className="rounded border px-3 py-2">Adicionar contato</button>
          </form>
        )}
      </section>
    </>
  );
}
