import { PageHeader } from '@/components/layout/page-header';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { sugestoesDeCargo } from '@/lib/usuarios';
import { convidarUsuario } from '../acoes';
import { FichaUsuario } from '../ficha-usuario';

/** Nova pessoa (spec 7.1): salvar envia o convite por e-mail e abre a ficha dela. */
export default async function NovaPessoa() {
  const eu = await exigirAdmin();
  const sb = await supabaseServidor();
  const [{ data: setores }, { data: cargos }, { data: cfgCargos }] = await Promise.all([
    sb.from('setores').select('id, nome, ativo').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('cargo').not('cargo', 'is', null),
    // Lista de Configurações › Cargos (D10); homologação sem a migração: a leitura falha e vale a lista padrão (D25).
    sb.from('configuracoes').select('cargos').eq('id', 1).maybeSingle(),
  ]);
  return (
    <section>
      <PageHeader titulo="Nova pessoa" migalhas={[{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões', href: '/usuarios' }, { rotulo: 'Nova pessoa' }]} />
      <FichaUsuario
        usuario={null}
        eu={eu.id}
        setores={setores ?? []}
        cargos={sugestoesDeCargo((cargos ?? []).map((c) => c.cargo), cfgCargos?.cargos ?? undefined)}
        acao={convidarUsuario}
        situacao={<p className="text-muted">Ativa ao salvar.</p>}
        rodape="Senha: a pessoa recebe um convite por e-mail para criar a senha."
      />
    </section>
  );
}
