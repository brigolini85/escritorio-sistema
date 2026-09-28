import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarIaDocumento, enviarDocumento, excluirDocumento } from '../cadastros-acoes';

export async function SecaoDocumentos({ id, pode, admin }: { id: string; pode: boolean; admin: boolean }) {
  const sb = await supabaseServidor();
  const { data: docs } = await sb.from('documentos_empresa').select('id, nome, arquivo_nome, ia_pode_enviar').eq('cliente_id', id).order('nome');
  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 text-sm">
      <p className="text-slate-500">Documentos marcados como "a IA pode enviar sozinha" são enviados na hora quando um contato autorizado desta empresa pedir. Os outros viram demanda para a equipe.</p>
      {(docs ?? []).length === 0 && <p className="text-slate-500">Nenhum documento cadastrado.</p>}
      <ul className="divide-y">
        {(docs ?? []).map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>{d.nome} · {d.arquivo_nome} · <span className={d.ia_pode_enviar ? 'text-emerald-700' : 'text-slate-500'}>{d.ia_pode_enviar ? 'a IA pode enviar sozinha' : 'só a equipe envia'}</span></span>
            <div className="flex items-center gap-3">
              <a href={`/api/documentos?id=${d.id}`} target="_blank" className="text-blue-700 underline">Baixar</a>
              {pode && (
                <form action={alternarIaDocumento.bind(null, id, d.id, !d.ia_pode_enviar)}>
                  <button className="rounded border px-2 py-1">{d.ia_pode_enviar ? 'Bloquear para a IA' : 'Liberar para a IA'}</button>
                </form>
              )}
              {admin && <form action={excluirDocumento.bind(null, id, d.id)}><button className="text-red-700 underline">Excluir</button></form>}
            </div>
          </li>
        ))}
      </ul>
      {pode && (
        <form action={enviarDocumento.bind(null, id)} className="flex flex-wrap items-center gap-2 border-t pt-3">
          <input name="nome" required placeholder="Nome do documento (ex.: Contrato social)" className="flex-1 rounded border p-2" />
          <input name="arquivo" type="file" required accept="application/pdf,image/*" className="text-xs" />
          <button className="rounded bg-slate-900 px-3 py-2 text-white">Enviar documento</button>
        </form>
      )}
    </div>
  );
}
