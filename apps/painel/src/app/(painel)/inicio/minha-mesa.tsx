import { MessageCircle, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { Button } from '@/components/ui/button';
import { capitalizar, dataDoTitulo, juntarNomes, primeiroNome, saudacao } from '@/lib/inicio';
import { textoComAgenteHoje } from '@/lib/minha-mesa';
import { temNivel, usaAssistente } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { AtalhosMesa } from './atalhos-mesa';
import { BlocoSistema } from './bloco-sistema';
import { CabecalhoInicio } from './cabecalho-inicio';
import { lerAvisos, lerLimitesEspera, lerNomesPessoas, paginaInicio } from './dados-inicio';
import { contarComAgenteHoje, lerEsperandoVoce, lerEstadoSistemaMesa, lerNomesDosMeusSetores } from './dados-mesa';
import { DemandasPorPrazo } from './demandas-por-prazo';
import { ListaAvisos } from './lista-avisos';
import { ListaEsperando } from './lista-esperando';
import { NumerosMesa } from './numeros-mesa';
import { SemResponsavelMesa } from './sem-responsavel-mesa';

/**
 * Minha mesa (imagem B), para quem não é administrador (D1). Nunca lê custo nem configuracoes: só o que a RLS da pessoa
 * libera e estado_sistema_resumo (sem valores). Recarrega pelo tempo real de sempre e a cada minuto (D2).
 */
export async function MinhaMesa({ u }: { u: UsuarioPainel }) {
  const podeAtendimento = temNivel(u, 'atendimento', 'meus_setores');
  const [{ agora }, setores, avisos, esperando, comAgente, limites, nomes, estado] = await Promise.all([
    paginaInicio(), lerNomesDosMeusSetores(u.setores.join(',')), lerAvisos(),
    podeAtendimento ? lerEsperandoVoce() : Promise.resolve(null),
    podeAtendimento ? contarComAgenteHoje() : Promise.resolve(null),
    lerLimitesEspera(), lerNomesPessoas(), lerEstadoSistemaMesa(),
  ]);
  return (
    <div data-inicio="mesa" className="flex max-w-7xl flex-col gap-6">
      <AtualizarAoVivo />
      <RecarregarPeriodico />
      <CabecalhoInicio
        titulo={<>{saudacao(agora)}, <span className="text-brand">{primeiroNome(u.nome)}</span></>}
        subtitulo={(
          <>
            {capitalizar(dataDoTitulo(agora))} ·{' '}
            {setores.length ? <>seus setores: <strong className="text-foreground">{juntarNomes(setores)}</strong></> : 'sem setor marcado'}
          </>
        )}
        acoes={(
          <>
            {usaAssistente(u) && (
              <Button asChild variant="outline">
                <Link href="/assistente"><Sparkles aria-hidden size={16} strokeWidth={1.75} />Perguntar ao assistente</Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/demandas?nova=1"><Plus aria-hidden size={16} strokeWidth={1.75} />Nova demanda</Link>
            </Button>
          </>
        )}
        atualizadoEm={agora.toISOString()}
      />
      <NumerosMesa u={u} podeAtendimento={podeAtendimento} />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <DemandasPorPrazo u={u} />
          <SemResponsavelMesa u={u} />
        </div>
        <div className="flex flex-col gap-4">
          {podeAtendimento && (
            <ListaEsperando
              id="titulo-conversas-mesa" titulo="Conversas esperando você" extra={setores.length ? juntarNomes(setores) : undefined}
              dados={esperando} limites={limites} estadoCtx={{ usuarioId: u.id, nomes, pausaGeral: estado?.agentePausado ?? null }}
              vazio="Ninguém esperando você agora."
              rodape={(
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                  <span className="text-muted">{comAgente === null ? '' : textoComAgenteHoje(comAgente)}</span>
                  <Button asChild variant="grafite" size="sm">
                    <Link href="/atendimento"><MessageCircle aria-hidden size={16} strokeWidth={1.75} />Abrir atendimento</Link>
                  </Button>
                </div>
              )}
            />
          )}
          <AtalhosMesa u={u} />
          <BlocoSistema />
        </div>
      </div>
      {(avisos?.total ?? 0) > 0 && <ListaAvisos dados={avisos} extra="para você" />}
    </div>
  );
}
