'use client';
import { useTransition, type ReactNode } from 'react';
import { Lock, Radar, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { textoAgenda } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { formatarHoraOuDia } from '@/lib/formatos';
import { ligarRadar, pedirGiroRadar } from '@/lib/radar-acoes';
import type { TelaRadar } from '@/lib/radar';
import { textoCustoMes, textoProximoGiro } from './textos';

const SoDono = () => <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock aria-hidden size={12} />só o dono</span>;

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{rotulo}</dt>
      <dd className="text-base font-bold tabular">{valor}</dd>
      {detalhe && <dd className="text-xs text-muted">{detalhe}</dd>}
    </div>
  );
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Cabeçalho da Visão geral do Radar (imagem 00-agente-radar). As janelas de agenda e de giros anteriores entram pelos slots (Task 10). */
export function CabecalhoRadar({ tela, dono, admin, cotacao, agoraIso, botaoAgenda, botaoGiros }: {
  tela: TelaRadar; dono: boolean; admin: boolean; cotacao: number | null; agoraIso: string; botaoAgenda?: ReactNode; botaoGiros?: ReactNode;
}) {
  const [ocupado, iniciar] = useTransition();
  const agora = new Date(agoraIso);
  const { config, giros, mes } = tela;
  const ligado = config.estado !== 'desligado';
  const ultimo = giros.find((g) => g.estado === 'concluido' || g.estado === 'falhou');
  const emAndamento = giros.some((g) => g.estado === 'pendente' || g.estado === 'rodando');
  const podeProcurar = dono || admin;
  const motivoSemProcurar = !podeProcurar ? 'Só o dono e o administrador pedem um giro.'
    : config.estado === 'desligado' ? 'O Radar está desligado.' : emAndamento ? 'Já tem um giro em andamento.' : null;

  const alternar = (novo: boolean) => iniciar(async () => {
    const r = await ligarRadar(novo);
    if (r.ok) toast(novo ? 'Radar ligado.' : 'Radar desligado.'); else toast.error(r.erro);
  });
  const procurar = () => iniciar(async () => {
    const r = await pedirGiroRadar();
    if (r.ok) toast('Giro pedido. Começa em até 1 minuto.'); else toast.error(r.erro);
  });

  return (
    <Card data-testid="radar-cabecalho" className="flex flex-col gap-4 p-4" role="region" aria-label="Radar de legislação">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Radar aria-hidden size={20} className="text-brand" />Radar de legislação</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info"><Search aria-hidden />Busca em fontes oficiais</Badge>
            <Badge variant="neutral"><ShieldCheck aria-hidden />Só sugere, não altera nada</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {botaoGiros}
          <Button type="button" size="sm" disabled={ocupado || !!motivoSemProcurar} onClick={procurar} aria-describedby="radar-procurar-motivo">
            <Search aria-hidden size={14} />Procurar agora
          </Button>
        </div>
      </div>
      <p id="radar-procurar-motivo" className="text-xs text-muted empty:hidden">{motivoSemProcurar}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Estado</p>
          <div className="flex flex-wrap items-center gap-2">
            {dono && <Switch checked={ligado} disabled={ocupado} onCheckedChange={alternar} aria-label="Radar ligado" />}
            <span className="text-sm font-bold">{config.estado === 'ligado' ? 'Ligado' : config.estado === 'teste' ? 'Em teste' : 'Desligado'}</span>
            {!dono && <SoDono />}
          </div>
          {config.estado === 'teste' && <p className="text-xs text-muted">Em teste: só PROCURAR AGORA.</p>}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Agenda</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{textoAgenda({ hora: config.hora, dias: config.dias })}</span>
            {dono ? botaoAgenda : <SoDono />}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 lg:grid-cols-4">
        <Numero rotulo="Último giro" valor={ultimo ? formatarHoraOuDia(ultimo.terminadoEm ?? ultimo.iniciadoEm ?? ultimo.criadoEm, agora) : 'nenhum ainda'}
          detalhe={ultimo ? `${plural(ultimo.fontes, 'fonte', 'fontes')} · ${plural(ultimo.novidades, 'novidade', 'novidades')}` : undefined} />
        <Numero rotulo="Próximo giro" valor={textoProximoGiro(config, agora)} />
        <Numero rotulo="Custo do mês" valor={textoCustoMes(mes.custoUsd, cotacao)} />
        <Numero rotulo="No mês" valor={`${plural(mes.novidades, 'novidade', 'novidades')} · ${plural(mes.demandas, 'demanda', 'demandas')}`} />
      </dl>
    </Card>
  );
}
