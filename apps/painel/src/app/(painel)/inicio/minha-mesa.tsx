import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { capitalizar, dataDoTitulo, juntarNomes, primeiroNome, saudacao } from '@/lib/inicio';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { CabecalhoInicio } from './cabecalho-inicio';
import { paginaInicio } from './dados-inicio';
import { lerNomesDosMeusSetores } from './dados-mesa';
import { DemandasPorPrazo } from './demandas-por-prazo';
import { NumerosMesa } from './numeros-mesa';

/** Minha mesa (imagem B), para quem não é administrador. Nunca lê custo nem configuracoes. A Task 8 completa. */
export async function MinhaMesa({ u }: { u: UsuarioPainel }) {
  const { agora } = await paginaInicio();
  const setores = await lerNomesDosMeusSetores(u.setores.join(','));
  const podeAtendimento = temNivel(u, 'atendimento', 'meus_setores');
  return (
    <div data-inicio="mesa" className="flex max-w-7xl flex-col gap-6">
      <AtualizarAoVivo />
      <RecarregarPeriodico />
      <CabecalhoInicio
        titulo={<>{saudacao(agora)}, <span className="text-brand">{primeiroNome(u.nome)}</span></>}
        subtitulo={<>{capitalizar(dataDoTitulo(agora))} · {setores.length ? <>seus setores: <strong className="text-foreground">{juntarNomes(setores)}</strong></> : 'sem setor marcado'}</>}
        atualizadoEm={agora.toISOString()}
      />
      <NumerosMesa u={u} podeAtendimento={podeAtendimento} />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <DemandasPorPrazo u={u} />
        </div>
      </div>
    </div>
  );
}
