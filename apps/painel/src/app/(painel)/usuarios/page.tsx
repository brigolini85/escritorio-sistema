import { variantesTelefone } from '@escritorio/core';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { convidarUsuario, salvarUsuario } from './acoes';
import { PERMISSOES } from './esquemas';

const caixa = 'rounded-lg border bg-white p-4 space-y-3';
const input = 'rounded border p-2';

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await exigirAdmin();
  const { erro } = await searchParams;
  const sb = await supabaseServidor();
  const [{ data: usuarios }, { data: setores }, { data: contatos }] = await Promise.all([
    sb.from('usuarios').select('*, usuario_setores(setor_id)').order('nome'),
    // Todos os setores, inclusive os inativos: senão salvar o usuário apagaria a ligação dele com um setor desativado.
    sb.from('setores').select('id, nome, ativo').order('nome'),
    sb.from('contatos').select('nome, telefone'),
  ]);
  /** Número que também é de um contato (cliente): com o assistente pelo WhatsApp, as mensagens vão para o assistente. */
  const contatoDoTelefone = (tel: string | null) =>
    tel ? (contatos ?? []).find((c) => variantesTelefone(tel).includes(c.telefone))?.nome ?? null : null;

  const campos = (u?: NonNullable<typeof usuarios>[number]) => (
    <>
      <div className="grid grid-cols-2 gap-2">
        <input name="nome" defaultValue={u?.nome} placeholder="Nome" required className={input} />
        <input name="email" defaultValue={u?.email} placeholder="E-mail" required readOnly={Boolean(u)} className={input} />
        <input name="telefone" defaultValue={u?.telefone ?? ''} placeholder="Telefone com DDD (para o assistente pelo WhatsApp)" className={input} />
        <select name="papel" defaultValue={u?.papel ?? 'atendente'} className={input}>
          <option value="atendente">Atendente</option><option value="admin">Administrador</option>
        </select>
      </div>
      <p className="text-sm font-medium">Setores</p>
      <div className="flex flex-wrap gap-3 text-sm">
        {(setores ?? []).map((s) => <label key={s.id} className="flex items-center gap-1"><input type="checkbox" name="setor" value={s.id} defaultChecked={u?.usuario_setores.some((x) => x.setor_id === s.id)} />{s.nome}{s.ativo ? '' : ' (inativo)'}</label>)}
      </div>
      <p className="text-sm font-medium">Permissões</p>
      <div className="grid gap-1 text-sm">
        {PERMISSOES.map((p) => <label key={p.valor} className="flex items-center gap-1"><input type="checkbox" name="permissao" value={p.valor} defaultChecked={u?.permissoes.includes(p.valor)} />{p.rotulo}</label>)}
      </div>
    </>
  );

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Usuários</h1>
      {erro && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
      <p className="text-sm text-slate-500">O administrador pode tudo no painel. As marcações do assistente valem para todos, inclusive o administrador.</p>
      <section className={caixa}>
        {(usuarios ?? []).map((u) => {
          const contato = u.permissoes.includes('assistente_whatsapp') ? contatoDoTelefone(u.telefone) : null;
          return (
            <details key={u.id} className="rounded border p-2">
              <summary className="cursor-pointer">
                {u.nome} · {u.papel === 'admin' ? 'Administrador' : 'Atendente'}{u.ativo ? '' : ' · desativado'}
                {u.permissoes.includes('assistente_site') ? ' · assistente no site' : ''}{u.permissoes.includes('assistente_whatsapp') ? ' · assistente no WhatsApp' : ''}
              </summary>
              {contato && (
                <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                  Este número também é do contato {contato}. Com o assistente pelo WhatsApp ligado, as mensagens dele vão para o assistente, não para o agente de clientes.
                </p>
              )}
              <form action={salvarUsuario.bind(null, u.id)} className="mt-2 grid gap-2">
                {campos(u)}
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="ativo" defaultChecked={u.ativo} /> Ativo</label>
                <button className="w-fit rounded bg-slate-900 px-3 py-1 text-white">Salvar usuário</button>
              </form>
            </details>
          );
        })}
      </section>
      <section className={caixa}>
        <h2 className="font-semibold">Convidar pessoa</h2>
        <p className="text-sm text-slate-500">Ela recebe um e-mail para definir a senha.</p>
        <form action={convidarUsuario} className="grid gap-2">
          {campos()}
          <button className="w-fit rounded bg-slate-900 px-3 py-1 text-white">Enviar convite</button>
        </form>
      </section>
    </div>
  );
}
