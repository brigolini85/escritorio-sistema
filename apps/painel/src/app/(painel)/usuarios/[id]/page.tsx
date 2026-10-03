import { lerNiveis, variantesTelefone } from '@escritorio/core';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { AvisoArquivado } from '@/components/patterns/lista-arquivados';
import { lerHorarioDoBanco } from '@/lib/horario-acesso';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { dataCadastro, sugestoesDeCargo, textoUltimoAcesso } from '@/lib/usuarios';
import { salvarUsuario } from '../acoes';
import { AvisoContato } from '../aviso-contato';
import { FichaUsuario, type FichaDados } from '../ficha-usuario';
import { ReenviarConvite } from '../reenviar-convite';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ficha da pessoa em página inteira (spec 7.1, imagem 06). Arquivada: só o aviso com Restaurar. */
export default async function PaginaPessoa({ params }: { params: Promise<{ id: string }> }) {
  const eu = await exigirAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sb = await supabaseServidor();
  const [{ data: u }, { data: setores }, { data: cargos }, { data: contatos }] = await Promise.all([
    sb.from('usuarios').select('*, usuario_setores(setor_id), usuario_permissoes(modulo, nivel)').eq('id', id).maybeSingle(),
    // Todos os setores, inclusive os inativos: senão salvar a pessoa apagaria a ligação dela com um setor desativado.
    sb.from('setores').select('id, nome, ativo').order('nome'),
    sb.from('usuarios').select('cargo').not('cargo', 'is', null),
    sb.from('contatos').select('nome, telefone'),
  ]);
  if (!u) notFound();
  const migalhas = [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões', href: '/usuarios' }, { rotulo: u.nome }];
  const topo = <p className="text-sm text-muted">Último acesso: {textoUltimoAcesso(u.ultimo_acesso_em, new Date())} · Cadastro: {dataCadastro(u.criado_em)}</p>;

  if (!u.ativo) {
    const arquivadoPor = u.arquivado_por ? (await sb.from('usuarios').select('nome').eq('id', u.arquivado_por).maybeSingle()).data?.nome ?? null : null;
    return (
      <section>
        <PageHeader titulo={u.nome} migalhas={migalhas} acoes={topo} />
        <AvisoArquivado tipo="usuario" id={u.id} nome={u.nome} arquivadoEm={u.arquivado_em} arquivadoPor={arquivadoPor} pode />
      </section>
    );
  }

  const niveis = lerNiveis(Object.fromEntries(u.usuario_permissoes.map((p) => [p.modulo, p.nivel])));
  const dados: FichaDados = {
    id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, cargo: u.cargo, papel: u.papel,
    setores: u.usuario_setores.map((s) => s.setor_id), niveis, horario: lerHorarioDoBanco(u.horario_acesso), observacoes: u.observacoes,
  };
  const contato = niveis.assistente === 'site_whatsapp' && u.telefone
    ? (contatos ?? []).find((c) => variantesTelefone(u.telefone!).includes(c.telefone))?.nome ?? null
    : null;

  return (
    <section>
      <PageHeader titulo={u.nome} migalhas={migalhas} acoes={topo} />
      <FichaUsuario
        // Voltou do servidor com dados novos (salvou): a ficha recomeça com eles.
        key={JSON.stringify(dados)}
        usuario={dados}
        eu={eu.id}
        setores={setores ?? []}
        cargos={sugestoesDeCargo((cargos ?? []).map((c) => c.cargo))}
        acao={salvarUsuario.bind(null, u.id)}
        aviso={contato && <AvisoContato contato={contato} />}
        situacao={(
          <p className="flex items-center gap-2 text-success">
            <span aria-hidden className="size-2 rounded-full bg-current" />
            Ativo
          </p>
        )}
        rodape={<>Senha: convite enviado por e-mail · <ReenviarConvite id={u.id} /></>}
      />
      {u.id !== eu.id && <div className="mt-6"><ExcluirCadastro tipo="usuario" id={u.id} nome={u.nome} variante="area" voltarPara="/usuarios" /></div>}
    </section>
  );
}
