import { estaNoExpediente } from '@escritorio/core';
import { CircleDot, Gauge, PauseCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { situacaoTeto } from '@/lib/inicio';
import type { UsuarioPainel } from '@/lib/sessao';
import { alternarPausaGeral } from './acoes';
import { paginaInicio } from './dados-inicio';
import { lerConfigSituacao, lerDemandasDoDia, lerFeriadosDeHoje, lerGastoSituacao, lerNumerosAgente } from './dados-situacao';

const ESTADO = {
  atendendo: { titulo: 'Atendendo', Icone: CircleDot, cor: 'text-success' },
  pausado: { titulo: 'Pausado', Icone: PauseCircle, cor: 'text-danger' },
  teto: { titulo: 'Parado pelo teto de IA', Icone: Gauge, cor: 'text-danger' },
} as const;

/** Cartão do agente (imagem A): estado, números do dia e PAUSAR/RETOMAR (só o administrador; a ação confere de novo). */
export async function CartaoAgente({ u }: { u: UsuarioPainel }) {
  const [cfg, gasto, numeros, doDia, feriados, { agora }] = await Promise.all([
    lerConfigSituacao(), lerGastoSituacao(u.id), lerNumerosAgente(), lerDemandasDoDia(), lerFeriadosDeHoje(), paginaInicio(),
  ]);
  if (!cfg) {
    return <Card data-testid="inicio-agente" className="p-4 text-sm text-muted">O estado do agente não pôde ser lido agora.</Card>;
  }
  const tetoAtingido = gasto ? situacaoTeto(gasto.total, Number(cfg.teto_ia_usd)).nivel === 'atingido' : false;
  const tipo = cfg.agente_pausado ? 'pausado' : tetoAtingido ? 'teto' : 'atendendo';
  const { titulo, Icone, cor } = ESTADO[tipo];
  const noExpediente = estaNoExpediente(agora, {
    inicio: String(cfg.horario_inicio).slice(0, 5), fim: String(cfg.horario_fim).slice(0, 5), diasUteis: cfg.dias_uteis, feriados,
  });
  const detalhe = tipo === 'pausado'
    ? 'Todas as mensagens vão para a equipe.'
    : tipo === 'teto'
      ? 'O gasto do mês chegou ao teto: as mensagens vão para a equipe até o mês virar ou o teto subir.'
      : noExpediente ? 'dentro do expediente' : 'fora do expediente';
  const pct = numeros && numeros.conversas > 0 ? `${Math.round((numeros.resolvidas / numeros.conversas) * 100)}%` : '—';

  return (
    <Card data-testid="inicio-agente" className="gap-4 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Agente</h2>
        <span className="text-sm text-subtle">robô do WhatsApp</span>
      </div>
      <div>
        <p data-estado-agente={tipo} className={cn('flex items-center gap-2 text-2xl font-extrabold', cor)}>
          <Icone aria-hidden size={20} strokeWidth={2} />{titulo}
        </p>
        <p className="text-sm text-muted">{detalhe}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        {[
          ['conversas', numeros ? String(numeros.conversas) : '—', 'conversas hoje', 'text-foreground'],
          ['resolvidas', pct, 'resolvidas por ele', 'text-success'],
          ['demandas', doDia ? String(doDia.doAgente) : '—', 'demandas abertas', 'text-foreground'],
        ].map(([chave, valor, rotulo, corValor]) => (
          <div key={chave} className="flex flex-col-reverse">
            <dt className="text-xs text-muted">{rotulo}</dt>
            <dd data-agente-numero={chave} className={cn('tabular text-2xl font-extrabold', corValor)}>{valor}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{cfg.agente_pausado ? 'Retomar volta a responder os clientes.' : 'Pausar manda tudo para a equipe.'}</p>
        <ConfirmDialog
          key={String(cfg.agente_pausado)}
          acao={alternarPausaGeral.bind(null, !cfg.agente_pausado)}
          gatilho={<Button variant={cfg.agente_pausado ? 'primary' : 'outline'} size="sm">{cfg.agente_pausado ? 'Retomar agente' : 'Pausar agente'}</Button>}
          titulo={cfg.agente_pausado ? 'Retomar o agente?' : 'Pausar o agente?'}
          descricao={cfg.agente_pausado
            ? 'O agente volta a responder os clientes no WhatsApp.'
            : 'O agente para de responder todos os clientes. As mensagens novas vão para a equipe atender no painel.'}
          confirmar={cfg.agente_pausado ? 'Retomar agente' : 'Pausar agente'}
          enviando={cfg.agente_pausado ? 'Retomando…' : 'Pausando…'}
          variante={cfg.agente_pausado ? 'primary' : 'danger'}
        />
      </div>
    </Card>
  );
}
