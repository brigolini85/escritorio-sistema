import { notFound } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { lerAgente, lerSkills, parteI3bAplicada, podeTreinarAgente, souDono } from '@/lib/agentes';
import { lerEmPaginas } from '@/lib/paginas';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { comoTestar } from '@/lib/testar-setor';
import { valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { AVISO_EMPRESAS_INCOMPLETAS, opcaoEmpresa } from '../../../treinar-agente/esquemas';
import { Simulador } from '../../../treinar-agente/simulador';
import { Hidratado } from '../../../treinar-agente/hidratado';
import { SemPermissao } from '../../../treinar-agente/tela-orientacoes';
import { TEXTO_TESTE_SEM_I3B, TEXTO_TESTE_SETOR, TEXTO_TESTE_TRABALHO } from '../textos';
import { TestarSkill } from './testar-skill';

/** Aba Testar (spec 7E.1, 7C.5, D21): o simulador sem rascunho; o dono pode incluir uma skill (mesmo desligada). */
export default async function Testar({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ParamsBusca> }) {
  const [{ slug }, busca, u] = await Promise.all([params, searchParams, obterUsuario()]);
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono, i3b] = await Promise.all([lerAgente(sb, slug), souDono(sb), parteI3bAplicada(sb)]);
  if (!agente) notFound();
  const como = comoTestar(agente, i3b);
  if (como === 'trabalho') return <EmptyState icone={FlaskConical} titulo={TEXTO_TESTE_TRABALHO} />;
  if (como === 'sem_i3b') return <EmptyState icone={FlaskConical} titulo={TEXTO_TESTE_SEM_I3B} />;
  // Setor (D11): o dono ou quem treina o agente (o banco confere de novo); o Thiago, como sempre.
  if (como === 'setor' ? !dono && !podeTreinarAgente(u, agente) : !temNivel(u, 'treinar', 'sim') && !dono) return <SemPermissao />;
  const skills = dono && !semMigracao ? await lerSkills(sb, agente.id) : [];
  const skill = skills.find((s) => s.id === valorParam(busca, 'skill')) ?? null;
  const empresas = await lerEmPaginas((de, ate) => sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo').eq('ativo', true)
    .order('razao_social').order('id').range(de, ate));
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border lg:altura-trabalho lg:flex-row">
      <Hidratado />
      <section aria-label="Sobre o teste" className="flex flex-col gap-3 bg-surface p-4 lg:flex-1">
        <p className="text-sm">{como === 'setor' ? TEXTO_TESTE_SETOR : 'Escreva como cliente e veja a resposta e o que o agente faria. Nada é enviado nem gravado; o custo conta em Gastos com IA como "Testar o agente".'}</p>
        {dono && skills.length > 0 && <TestarSkill slug={agente.slug} skills={skills} atual={skill?.id ?? null} />}
        {skill && <p className="text-sm">Testando com a skill <b>{skill.titulo}</b>{skill.ativo ? '' : ' (desligada)'}.</p>}
      </section>
      <Simulador key={skill?.id ?? 'sem-skill'} aberta={null} idOrientacao={null} salva={null} empresas={empresas.data.map(opcaoEmpresa)}
        avisoEmpresas={empresas.error || empresas.parcial ? AVISO_EMPRESAS_INCOMPLETAS : null} skillId={skill?.id ?? null}
        agente={como === 'setor' ? { slug: agente.slug, modoPadrao: agente.modoContato ?? 'por_tras' } : null} />
    </div>
  );
}
