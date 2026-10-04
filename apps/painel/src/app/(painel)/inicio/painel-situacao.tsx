import { Bell, ClipboardList, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { EmptyState } from '@/components/patterns/empty-state';
import { RelativeTime } from '@/components/patterns/relative-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { dataDoTitulo, primeiroNome, saudacao, situacaoTeto } from '@/lib/inicio';
import type { UsuarioPainel } from '@/lib/sessao';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { marcarAlertaLido } from './acoes';
import { CabecalhoInicio } from './cabecalho-inicio';
import { CartaoAgente } from './cartao-agente';
import { CartaoGasto } from './cartao-gasto';
import { CartaoSinais } from './cartao-sinais';
import { paginaInicio } from './dados-inicio';
import { lerConfigSituacao, lerGastoSituacao, lerSinaisSituacao } from './dados-situacao';
import { FaixaAlertas } from './faixa-alertas';
import { NumerosSituacao } from './numeros-situacao';

const NIVEL_AVISO: Record<string, { rotulo: string; variant: 'danger' | 'warning' | 'info' }> = {
  critico: { rotulo: 'Crítico', variant: 'danger' },
  operacional: { rotulo: 'Operacional', variant: 'warning' },
  aviso: { rotulo: 'Aviso', variant: 'info' },
};

/** Início do administrador (Painel de situação). As Tasks 4 a 6 trocam cada pedaço pelo da imagem A. */
export async function PainelSituacao({ u }: { u: UsuarioPainel }) {
  const { sb, agora } = await paginaInicio();

  const [{ data: alertas }, cfg, gasto, sinais] = await Promise.all([
    sb.from('alertas').select('*').is('lido_em', null).order('criado_em', { ascending: false }).limit(20),
    lerConfigSituacao(),
    lerGastoSituacao(u.id),
    lerSinaisSituacao(),
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

      <section aria-labelledby="avisos" className="flex flex-col gap-3">
        <h2 id="avisos" className="text-lg font-semibold text-foreground">Avisos</h2>
        <Card>
          {(alertas ?? []).length === 0 ? (
            <EmptyState icone={Bell} titulo="Nenhum aviso." descricao="Os avisos do agente e do sistema aparecem aqui." className="py-6" />
          ) : (
            <ul className="divide-y divide-border">
              {(alertas ?? []).map((a) => {
                const nivel = NIVEL_AVISO[a.nivel] ?? NIVEL_AVISO.aviso!;
                return (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <Badge variant={nivel.variant} className="mt-0.5">{nivel.rotulo}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-foreground', a.nivel === 'critico' && 'font-medium')}>{a.mensagem}</p>
                      <RelativeTime data={a.criado_em} className="text-xs text-muted" />
                    </div>
                    <form action={marcarAlertaLido.bind(null, a.id)}>
                      <Button type="submit" variant="ghost" size="sm" title="Marcar como visto">ok</Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
