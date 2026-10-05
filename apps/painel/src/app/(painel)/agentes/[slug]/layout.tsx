import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { acessoAosAgentes, lerAgente, lerContagens, lerContatosTeste, lerModelos, lerMudancas, lerNumeros, souDono } from '@/lib/agentes';
import { lerPeriodo } from '@/lib/gastos';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { SemPermissao } from '../../treinar-agente/tela-orientacoes';
import { AbasAgente } from './abas-agente';
import { CabecalhoAgente } from './cabecalho-agente';
import { FaixaSemMigracao, FaixaSoThiago } from './faixas';

/** Ficha do agente (spec 7E.3): cabeçalho e abas em todas as abas. Quem não vê os agentes recebe a tela de sempre do Treinar (D22). */
export default async function FichaDoAgente({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const [{ slug }, u] = await Promise.all([params, obterUsuario()]);
  const sb = await supabaseServidor();
  const acesso = acessoAosAgentes(u, await souDono(sb));
  if (!acesso.ver) return <SemPermissao />;
  const { agente, semMigracao } = await lerAgente(sb, slug);
  if (!agente) notFound();
  const mes = lerPeriodo({}, new Date());
  const [contagens, numeros, contatosTeste, modelos, mudancas] = await Promise.all([
    semMigracao ? Promise.resolve(null) : lerContagens(sb, [agente]),
    acesso.numeros && !semMigracao ? lerNumeros(sb, mes.de, mes.ate) : Promise.resolve(null),
    semMigracao ? Promise.resolve([]) : lerContatosTeste(sb, agente.id),
    lerModelos(sb),
    semMigracao ? Promise.resolve([]) : lerMudancas(sb, agente.id, 200),
  ]);
  const c = contagens?.get(agente.id);
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoAgente agente={agente} dono={acesso.dono && !semMigracao} numeros={numeros?.get(agente.id) ?? null} mostrarNumeros={acesso.numeros}
        contatosTeste={contatosTeste} modelos={modelos} mudancas={mudancas} />
      <AbasAgente slug={agente.slug} contagem={c ? { skills: c.skills, ferramentas: c.ferramentas } : {}} />
      {semMigracao && <FaixaSemMigracao />}
      {!agente.portaDeEntrada && <FaixaSoThiago />}
      {children}
    </div>
  );
}
