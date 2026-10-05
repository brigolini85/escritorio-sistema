import { notFound } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { lerAgente, lerSkills, souDono } from '@/lib/agentes';
import { lerEmPaginas } from '@/lib/paginas';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { AVISO_EMPRESAS_INCOMPLETAS, opcaoEmpresa } from '../../../treinar-agente/esquemas';
import { Simulador } from '../../../treinar-agente/simulador';
import { SemPermissao } from '../../../treinar-agente/tela-orientacoes';
import { TEXTO_TESTE_AGENTE_SETOR } from '../textos';
import { TestarSkill } from './testar-skill';

/** Aba Testar (spec 7E.1, 7C.5, D21): o simulador sem rascunho; o dono pode incluir uma skill (mesmo desligada). */
export default async function Testar({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ParamsBusca> }) {
  const [{ slug }, busca, u] = await Promise.all([params, searchParams, obterUsuario()]);
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  if (!agente.portaDeEntrada) return <EmptyState icone={FlaskConical} titulo={TEXTO_TESTE_AGENTE_SETOR} />;
  if (!temNivel(u, 'treinar', 'sim') && !dono) return <SemPermissao />;
  const skills = dono && !semMigracao ? await lerSkills(sb, agente.id) : [];
  const skill = skills.find((s) => s.id === valorParam(busca, 'skill')) ?? null;
  const empresas = await lerEmPaginas((de, ate) => sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo').eq('ativo', true)
    .order('razao_social').order('id').range(de, ate));
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border lg:altura-trabalho lg:flex-row">
      <section aria-label="Sobre o teste" className="flex flex-col gap-3 bg-surface p-4 lg:flex-1">
        <p className="text-sm">Escreva como cliente e veja a resposta e o que o agente faria. Nada é enviado nem gravado; o custo conta em Gastos com IA como "Testar o agente".</p>
        {dono && skills.length > 0 && <TestarSkill slug={agente.slug} skills={skills} atual={skill?.id ?? null} />}
        {skill && <p className="text-sm">Testando com a skill <b>{skill.titulo}</b>{skill.ativo ? '' : ' (desligada)'}.</p>}
      </section>
      <Simulador key={skill?.id ?? 'sem-skill'} aberta={null} idOrientacao={null} salva={null} empresas={empresas.data.map(opcaoEmpresa)}
        avisoEmpresas={empresas.error || empresas.parcial ? AVISO_EMPRESAS_INCOMPLETAS : null} skillId={skill?.id ?? null} />
    </div>
  );
}
