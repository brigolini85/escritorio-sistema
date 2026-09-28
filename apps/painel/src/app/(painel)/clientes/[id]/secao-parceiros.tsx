import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarGrupo, salvarUnidade } from '../cadastros-acoes';

const input = 'rounded border p-2 text-sm disabled:bg-slate-50';

export async function SecaoParceiros({ id, tipo, pode }: { id: string; tipo: 'cliente' | 'fornecedor'; pode: boolean }) {
  const sb = await supabaseServidor();
  const { data: grupos } = await sb.from('parceiros_grupos')
    .select('id, nome, palavras_chave, ativo, parceiros_unidades(id, nome_unidade, razao_social, cnpj, inscricao_estadual, endereco, bairro, cidade, uf, palavras_chave, ativo)')
    .eq('cliente_id', id).eq('tipo', tipo).order('nome');
  const nomeGrupo = tipo === 'cliente' ? 'rede/cliente' : 'fornecedor';

  const camposUnidade = (un?: NonNullable<typeof grupos>[number]['parceiros_unidades'][number]) => (
    <fieldset disabled={!pode} className="grid grid-cols-3 gap-2">
      <input name="nome_unidade" defaultValue={un?.nome_unidade} placeholder="Nome da unidade (ex.: Santa Efigênia)" required className={input} />
      <input name="razao_social" defaultValue={un?.razao_social ?? ''} placeholder="Razão social" className={input} />
      <input name="cnpj" defaultValue={un?.cnpj ?? ''} placeholder="CNPJ" className={input} />
      <input name="inscricao_estadual" defaultValue={un?.inscricao_estadual ?? ''} placeholder="Inscrição estadual" className={input} />
      <input name="endereco" defaultValue={un?.endereco ?? ''} placeholder="Endereço" className={input} />
      <input name="bairro" defaultValue={un?.bairro ?? ''} placeholder="Bairro" className={input} />
      <input name="cidade" defaultValue={un?.cidade ?? ''} placeholder="Cidade" className={input} />
      <input name="uf" defaultValue={un?.uf ?? ''} placeholder="UF" maxLength={2} className={input} />
      <input name="palavras_chave" defaultValue={un?.palavras_chave.join(', ')} placeholder="Palavras-chave, separadas por vírgula" className={input} />
    </fieldset>
  );

  return (
    <div className="space-y-4">
      {(grupos ?? []).length === 0 && <p className="text-sm text-slate-500">Nenhum {nomeGrupo} cadastrado.</p>}
      {(grupos ?? []).map((g) => (
        <section key={g.id} className={`space-y-3 rounded-lg border bg-white p-4 ${g.ativo ? '' : 'opacity-60'}`}>
          <form action={salvarGrupo.bind(null, id, tipo, g.id)} className="flex flex-wrap items-center gap-2">
            <fieldset disabled={!pode} className="contents">
              <input name="nome" defaultValue={g.nome} required className={`${input} font-semibold`} aria-label={`Nome de ${g.nome}`} />
              <input name="palavras_chave" defaultValue={g.palavras_chave.join(', ')} placeholder="Palavras-chave da rede" className={`${input} flex-1`} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="ativo" defaultChecked={g.ativo} /> Ativo</label>
              {pode && <button className="rounded border px-3 py-1 text-sm">Salvar</button>}
            </fieldset>
          </form>
          <ul className="space-y-2">
            {g.parceiros_unidades.map((un) => (
              <li key={un.id}>
                <details className="rounded border p-2 text-sm">
                  <summary className="cursor-pointer">
                    {un.nome_unidade}{un.bairro ? ` · ${un.bairro}` : ''}{un.cidade ? ` · ${un.cidade}` : ''}{un.cnpj ? ` · CNPJ ${un.cnpj}` : ''}{un.ativo ? '' : ' · inativa'}
                  </summary>
                  <form action={salvarUnidade.bind(null, id, g.id, un.id)} className="mt-2 space-y-2">
                    {camposUnidade(un)}
                    <label className="flex items-center gap-1"><input type="checkbox" name="ativo" defaultChecked={un.ativo} disabled={!pode} /> Ativa</label>
                    {pode && <button className="rounded bg-slate-900 px-3 py-1 text-white">Salvar unidade</button>}
                  </form>
                </details>
              </li>
            ))}
          </ul>
          {pode && (
            <form action={salvarUnidade.bind(null, id, g.id, null)} className="space-y-2 border-t pt-3 text-sm">
              <p className="font-medium">Nova unidade de {g.nome}</p>
              {camposUnidade()}
              <button className="rounded border px-3 py-1">Adicionar unidade</button>
            </form>
          )}
        </section>
      ))}
      {pode && (
        <form action={salvarGrupo.bind(null, id, tipo, null)} className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-4 text-sm">
          <input name="nome" required placeholder={tipo === 'cliente' ? 'Nova rede/cliente (ex.: Supermercado Brasil)' : 'Novo fornecedor'} className={`${input} flex-1`} />
          <input name="palavras_chave" placeholder="Palavras-chave, separadas por vírgula" className={`${input} flex-1`} />
          <button className="rounded bg-slate-900 px-3 py-2 text-white">{tipo === 'cliente' ? 'Criar rede' : 'Criar fornecedor'}</button>
        </form>
      )}
    </div>
  );
}
