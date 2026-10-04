import { ClipboardList, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { Button } from '@/components/ui/button';
import { dataDoTitulo, primeiroNome, saudacao, situacaoTeto } from '@/lib/inicio';
import type { UsuarioPainel } from '@/lib/sessao';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { CabecalhoInicio } from './cabecalho-inicio';
import { CartaoAgente } from './cartao-agente';
import { CartaoGasto } from './cartao-gasto';
import { CartaoSinais } from './cartao-sinais';
import { lerAvisos, lerLimitesEspera, lerNomesPessoas, paginaInicio } from './dados-inicio';
import { lerConfigSituacao, lerEsperandoSituacao, lerGastoSituacao, lerSinaisSituacao } from './dados-situacao';
import { FaixaAlertas } from './faixa-alertas';
import { ListaAvisos } from './lista-avisos';
import { ListaEsperando } from './lista-esperando';
import { ListaVencidas } from './lista-vencidas';
import { NumerosSituacao } from './numeros-situacao';
import { TabelaSetores } from './tabela-setores';

/**
 * Painel de situação (imagem A), só para o administrador (D1): faixa só com problema, cinco números, agente, sinais,
 * gasto × teto, demandas por setor, quem espera agora, vencidas e avisos. Recarrega pelo tempo real de sempre
 * (conversas, demandas) e a cada minuto (sinais, pausa e gasto, que não estão no Realtime, D2).
 */
export async function PainelSituacao({ u }: { u: UsuarioPainel }) {
  const [{ agora }, cfg, gasto, sinais, esperando, limites, nomes, avisos] = await Promise.all([
    paginaInicio(), lerConfigSituacao(), lerGastoSituacao(u.id), lerSinaisSituacao(), lerEsperandoSituacao(),
    lerLimitesEspera(), lerNomesPessoas(), lerAvisos(),
  ]);
  const teto = cfg && gasto ? situacaoTeto(gasto.total, Number(cfg.teto_ia_usd)) : null;
  return (
    <div data-inicio="situacao" className="flex max-w-7xl flex-col gap-6">
      <AtualizarAoVivo />
      <RecarregarPeriodico />
      <CabecalhoInicio
        titulo={<>Situação do escritório · <span className="text-brand">{dataDoTitulo(agora)}</span></>}
        subtitulo={`${saudacao(agora)}, ${primeiroNome(u.nome)}. Visão de administrador: todos os setores.`}
        acoes={(
          <>
            <Button asChild variant="outline">
              <Link href="/demandas"><ClipboardList aria-hidden size={16} strokeWidth={1.75} />Gestão das demandas</Link>
            </Button>
            <Button asChild>
              <Link href="/atendimento"><MessageCircle aria-hidden size={16} strokeWidth={1.75} />Abrir atendimento</Link>
            </Button>
          </>
        )}
        atualizadoEm={agora.toISOString()}
      />
      <FaixaAlertas teto={teto} sinais={sinais} />
      <NumerosSituacao />
      <div className="grid gap-4 lg:grid-cols-3">
        <CartaoAgente u={u} />
        <CartaoSinais />
        <CartaoGasto u={u} />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><TabelaSetores /></div>
        <div className="flex flex-col gap-4">
          <ListaEsperando
            id="titulo-esperando" titulo="Esperando pessoa agora" extra="mais antigo primeiro" dados={esperando} limites={limites}
            estadoCtx={{ usuarioId: u.id, nomes, pausaGeral: cfg?.agente_pausado ?? null }} vazio="Ninguém esperando agora."
          />
          <ListaVencidas />
        </div>
      </div>
      <ListaAvisos dados={avisos} extra="do agente e do sistema" />
    </div>
  );
}
