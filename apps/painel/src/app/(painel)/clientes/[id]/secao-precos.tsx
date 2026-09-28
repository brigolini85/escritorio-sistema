import Link from 'next/link';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { definirPreco } from '../cadastros-acoes';

const reais = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const valorCampo = (v: number) => v.toFixed(2).replace('.', ',');
const data = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

export async function SecaoPrecos({ id, podeEditar, historico }: { id: string; podeEditar: boolean; historico?: string }) {
  const sb = await supabaseServidor();
  const [{ data: redes }, { data: produtos }, { data: vigentes }] = await Promise.all([
    sb.from('parceiros_grupos').select('id, nome').eq('cliente_id', id).eq('tipo', 'cliente').eq('ativo', true).order('nome'),
    sb.from('produtos').select('id, codigo, descricao, unidade').eq('cliente_id', id).eq('ativo', true).order('descricao'),
    sb.from('precos').select('grupo_id, produto_id, valor').eq('cliente_id', id).is('vigente_ate', null),
  ]);
  const preco = (g: string, p: string) => vigentes?.find((x) => x.grupo_id === g && x.produto_id === p)?.valor;
  const [hGrupo, hProduto] = (historico ?? '').split(':');
  const { data: linhasHistorico } = hGrupo && hProduto
    ? await sb.from('precos').select('valor, vigente_desde, vigente_ate, usuarios(nome)').eq('grupo_id', hGrupo).eq('produto_id', hProduto).order('vigente_desde', { ascending: false })
    : { data: null };

  if (!(redes ?? []).length || !(produtos ?? []).length) {
    return <p className="rounded-lg border bg-white p-4 text-sm text-slate-500">Cadastre ao menos uma rede em "Clientes da empresa" e um produto em "Produtos" para montar a tabela de preços.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50"><th className="p-2 text-left">Produto</th>{redes!.map((r) => <th key={r.id} className="p-2 text-left">{r.nome}</th>)}</tr></thead>
          <tbody>
            {produtos!.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-2">{p.descricao} <span className="text-slate-500">({p.codigo} · {p.unidade})</span></td>
                {redes!.map((r) => {
                  const v = preco(r.id, p.id);
                  return (
                    <td key={r.id} className="p-2">
                      <form action={definirPreco.bind(null, id, r.id, p.id)} className="flex items-center gap-1">
                        R$ <input name="valor" defaultValue={v !== undefined ? valorCampo(Number(v)) : ''} disabled={!podeEditar}
                          aria-label={`Preço de ${p.descricao} para ${r.nome}`} className="w-24 rounded border p-1 disabled:bg-slate-50" />
                        <Link href={`/clientes/${id}?aba=precos&historico=${r.id}:${p.id}`} className="text-xs text-blue-700 underline">histórico</Link>
                      </form>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhasHistorico && (
        <section className="rounded-lg border bg-white p-4 text-sm">
          <h2 className="mb-2 font-semibold">Histórico de preço</h2>
          {linhasHistorico.length === 0 && <p className="text-slate-500">Sem preços registrados.</p>}
          <ul className="space-y-1">
            {linhasHistorico.map((h, i) => (
              <li key={i}>{reais(Number(h.valor))}{h.vigente_ate ? '' : ' · vigente'} · desde {data(h.vigente_desde)}{h.vigente_ate ? ` até ${data(h.vigente_ate)}` : ''}{h.usuarios?.nome ? ` · por ${h.usuarios.nome}` : ''}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
