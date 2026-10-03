import { lerNiveis } from '@escritorio/core';
import { Clock, Pencil, UserPlus, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type ColunaTabela } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/empty-state';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { LinkArquivados, TelaArquivados } from '@/components/patterns/lista-arquivados';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { horarioPermiteEm, lerHorarioDoBanco } from '@/lib/horario-acesso';
import { ROTULO_NIVEL } from '@/lib/permissoes';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerOrdem, valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { textoUltimoAcesso } from '@/lib/usuarios';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Linha = {
  id: string; nome: string; cargo: string | null; papel: 'admin' | 'atendente'; setores: string[];
  nivelDemandas: string; ultimoAcesso: string | null; foraAgora: boolean;
};

/** Pessoas do escritório (só o administrador): tabela; a ficha abre em página inteira (spec 7.1). */
export default async function Usuarios({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const eu = await exigirAdmin();
  const params = await searchParams;
  // Link antigo do painel lateral (Parte B), guardado em favoritos: abre a página da pessoa.
  const antigo = valorParam(params, 'usuario');
  if (antigo && UUID.test(antigo)) redirect(`/usuarios/${antigo}`);
  if (valorParam(params, 'ver') === 'arquivados') {
    return <TelaArquivados tipo="usuario" titulo="Usuários arquivados" voltar={{ rotulo: 'Usuários e permissões', href: '/usuarios' }} pode />;
  }
  const ordem = lerOrdem(params, ['nome'], { coluna: 'nome', direcao: 'asc' })!;
  const sb = await supabaseServidor();
  const [{ data: usuarios, error: erroLista }, { data: setores }] = await Promise.all([
    sb.from('usuarios')
      .select('id, nome, cargo, papel, ativo, ultimo_acesso_em, horario_acesso, usuario_setores(setor_id), usuario_permissoes(modulo, nivel)')
      .order('nome', { ascending: ordem.direcao === 'asc' }),
    sb.from('setores').select('id, nome, ativo').order('nome'),
  ]);
  if (erroLista) console.error('[usuarios] falha ao ler a lista', erroLista);
  const agora = new Date();
  const nomeSetor = new Map((setores ?? []).map((s) => [s.id, s]));
  const todas = usuarios ?? [];
  const ativos: Linha[] = todas.filter((u) => u.ativo).map((u) => {
    const niveis = lerNiveis(Object.fromEntries(u.usuario_permissoes.map((p) => [p.modulo, p.nivel])));
    return {
      id: u.id, nome: u.nome, cargo: u.cargo, papel: u.papel, setores: u.usuario_setores.map((s) => s.setor_id),
      nivelDemandas: u.papel === 'admin' ? 'Todas (administrador)' : ROTULO_NIVEL.demandas[niveis.demandas],
      ultimoAcesso: u.ultimo_acesso_em,
      foraAgora: u.papel !== 'admin' && !horarioPermiteEm(lerHorarioDoBanco(u.horario_acesso), agora),
    };
  });
  const arquivados = todas.length - ativos.length;

  const colunas: ColunaTabela<Linha>[] = [
    {
      id: 'nome', titulo: 'Nome / Cargo', ordenavel: true, className: 'min-w-56',
      celula: (u) => (
        <span className="flex flex-col">
          <span className="truncate font-medium text-foreground">{u.nome}</span>
          <span className="truncate text-sm text-muted">{[u.cargo, u.papel === 'admin' ? 'Administrador' : null].filter(Boolean).join(' · ') || 'Sem cargo'}</span>
        </span>
      ),
    },
    {
      id: 'setores', titulo: 'Setores',
      celula: (u) => {
        if (u.setores.length === 0) return <span className="text-subtle">nenhum</span>;
        const mostrar = u.setores.slice(0, 2);
        return (
          <span className="flex items-center gap-1" title={u.setores.map((s) => nomeSetor.get(s)?.nome ?? '').join(', ')}>
            {mostrar.map((s) => {
              const setor = nomeSetor.get(s);
              return <Badge key={s} variant={setor?.ativo === false ? 'outline' : 'neutral'}>{setor?.nome ?? 'setor removido'}</Badge>;
            })}
            {u.setores.length > mostrar.length && <span className="text-xs text-muted">+{u.setores.length - mostrar.length}</span>}
          </span>
        );
      },
    },
    { id: 'demandas', titulo: 'Nível de Demandas', celula: (u) => <span className="text-foreground">{u.nivelDemandas}</span> },
    { id: 'acesso', titulo: 'Último acesso', celula: (u) => <span className="tabular text-muted">{textoUltimoAcesso(u.ultimoAcesso, agora)}</span> },
    {
      id: 'situacao', titulo: 'Situação',
      celula: (u) => u.foraAgora ? (
        <span className="flex items-center gap-1.5 text-warning">
          <Clock aria-hidden size={16} strokeWidth={1.75} />
          Fora do horário agora
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-success">
          <span aria-hidden className="size-2 rounded-full bg-current" />
          Ativo
        </span>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        titulo="Usuários e permissões"
        contagem={ativos.length}
        descricao="Cada pessoa tem um nível por módulo e um horário de acesso. O administrador pode tudo e entra a qualquer hora."
        acoes={(
          <>
            <LinkArquivados href="/usuarios?ver=arquivados" total={arquivados} />
            <Link href="/usuarios/novo" className={variantesBotao({ size: 'sm' })}>
              <UserPlus aria-hidden size={16} strokeWidth={1.75} />
              Nova pessoa
            </Link>
          </>
        )}
      />
      <DataTable
        rotulo="Usuários"
        linhas={ativos}
        colunas={colunas}
        chave={(u) => u.id}
        params={params}
        ordem={ordem}
        hrefLinha={(u) => `/usuarios/${u.id}`}
        // Lápis abre a ficha; ninguém arquiva nem exclui o próprio acesso.
        acoesLinha={(u) => (
          <span className="flex items-center justify-end gap-1">
            <Link href={`/usuarios/${u.id}`} aria-label={`Editar ${u.nome}`} className={variantesBotao({ variant: 'outline', size: 'icon' })}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
            </Link>
            {u.id !== eu.id && <ExcluirCadastro tipo="usuario" id={u.id} nome={u.nome} />}
          </span>
        )}
        erro={erroLista ? 'Não consegui carregar as pessoas agora.' : undefined}
        vazio={<EmptyState icone={UsersRound} titulo="Nenhuma pessoa cadastrada." descricao="Cadastre a equipe pelo botão Nova pessoa." />}
      />
    </section>
  );
}
