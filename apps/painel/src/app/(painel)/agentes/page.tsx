import Link from 'next/link';
import { Bot, CircleDollarSign, LockKeyhole } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/patterns/empty-state';
import { variantesBotao } from '@/components/ui/button';
import { semMigracaoI1, acessoAosAgentes, lerAgentes, lerContagens, lerNumeros, lerTarefasProntas, souDono } from '@/lib/agentes';
import { lerPeriodo } from '@/lib/gastos';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { ParamsBusca } from '@/lib/tabela-url';
import { SemPermissao } from '../treinar-agente/tela-orientacoes';
import { CartaoAgente } from './cartao-agente';
import { radarSemMigracao } from './cartao-radar';
import { FiltrosAgentes } from './filtros-agentes';
import { contarPorEstado, filtrarAgentes, lerFiltrosAgentes } from './lista';
import { NovoAgente } from './novo-agente';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
/** I5: "para decidir" (head: true) e o último giro, lidos uma vez. Sem a migração: frase de hoje; outro erro: cartão sem a contagem. */
async function lerRadarDoCartao(sb: Sb, ler: boolean) {
  if (!ler) return null;
  const [cont, giro] = await Promise.all([
    sb.from('radar_novidades').select('id', { count: 'exact', head: true }).eq('estado', 'para_decidir'),
    sb.from('radar_giros').select('criado_em, terminado_em').order('criado_em', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (radarSemMigracao({ contagem: cont, giro })) return { semI5: true, paraDecidir: null, ultimoGiro: null };
  if (cont.error) {
    console.error('[agentes] contagem do Radar', cont.error);
    return { semI5: false, paraDecidir: null, ultimoGiro: null };
  }
  if (giro.error) console.error('[agentes] último giro do Radar', giro.error);
  const g = giro.data as { criado_em?: string; terminado_em?: string | null } | null;
  return { semI5: false, paraDecidir: cont.count ?? 0, ultimoGiro: g?.terminado_em ?? g?.criado_em ?? null };
}

/** Tela Agentes (spec 7E.2, imagem 00-agentes-lista): um cartão por agente, filtros, busca e + NOVO AGENTE (só o dono). */
export default async function Agentes({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const [params, u] = await Promise.all([searchParams, obterUsuario()]);
  const sb = await supabaseServidor();
  const acesso = acessoAosAgentes(u, await souDono(sb));
  if (!acesso.ver) return <SemPermissao />;
  const mes = lerPeriodo({}, new Date());
  const [{ agentes, semMigracao, erro }, { data: setores }, { data: emTeste }] = await Promise.all([
    lerAgentes(sb), sb.from('setores').select('id, nome').eq('ativo', true).order('nome'), sb.from('agente_contatos_teste').select('agente_id'),
  ]);
  const [contagens, numeros, prontas] = await Promise.all([
    semMigracao ? Promise.resolve(new Map()) : lerContagens(sb, agentes),
    acesso.numeros && !semMigracao ? lerNumeros(sb, mes.de, mes.ate) : Promise.resolve(null),
    semMigracao ? Promise.resolve(null) : lerTarefasProntas(sb),
  ]);
  const radar = await lerRadarDoCartao(sb, !semMigracao && agentes.some((a) => a.slug === 'radar'));
  const f = lerFiltrosAgentes(params);
  const visiveis = filtrarAgentes(agentes, f);
  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        titulo="Agentes"
        contagem={agentes.length}
        descricao="Um agente por departamento, mais o Radar de legislação. O Thiago atende no WhatsApp e chama os outros quando precisa."
        acoes={<div className="flex gap-2">
          {u.papel === 'admin' && <Link href="/gastos-ia" className={variantesBotao({ variant: 'outline' })}><CircleDollarSign aria-hidden size={16} />Gastos com IA</Link>}
          {acesso.dono && !semMigracao && <NovoAgente setores={setores ?? []} />}
        </div>}
      />
      <p className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm">
        <LockKeyhole aria-hidden size={16} className="text-brand" />
        <span><b>{acesso.dono ? 'Só você altera' : 'Só o dono altera'} skills, ferramentas e modo de contato.</b> Orientações: quem tem permissão.</span>
      </p>
      {semMigracao && <p className="rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">Os agentes aparecem quando a atualização do banco da Parte I for aplicada.</p>}
      {erro && <p role="alert" className="text-sm text-danger">Não consegui carregar os agentes agora.</p>}
      <FiltrosAgentes params={params} f={f} contagem={contarPorEstado(agentes)} />
      {visiveis.length === 0 ? (
        <EmptyState icone={Bot} titulo="Nenhum agente com esses filtros." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visiveis.map((a) => (
            <li key={a.id} className="flex">
              <CartaoAgente agente={a} contagens={contagens.get(a.id) ?? { skills: 0, ferramentas: a.ferramentas.length, orientacoes: 0 }}
                numeros={numeros?.get(a.id)} mostrarNumeros={acesso.numeros} contatosTeste={(emTeste ?? []).filter((t) => t.agente_id === a.id).length} prontas={prontas?.get(a.id) ?? null} radar={a.slug === 'radar' ? radar : null} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">
        <b className="text-foreground">Conversa</b>: fala no WhatsApp ou no painel. <b className="text-foreground">Trabalho</b>: tarefas longas em segundo plano (fechamento, conferências, relatórios).{' '}
        <b className="text-foreground">Teste</b>: só atende os contatos escolhidos. <b className="text-foreground">Sozinho</b>: resolvido sem passar para uma pessoa.
      </p>
    </section>
  );
}
