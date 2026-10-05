import { Info, TriangleAlert } from 'lucide-react';
import type { EstadoAgente, ModoContato, TipoAgente } from '@escritorio/core';

type SituacaoAgente = { semI2: boolean; estado: EstadoAgente; modo: ModoContato | null; tipos: TipoAgente[]; setor: string | null; contatosTeste: number };

/** D14: o que o agente do setor faz agora no atendimento, na ordem em que uma situação vence a outra. */
export function textoComoAtua(s: SituacaoAgente): { texto: string; aviso: boolean } {
  if (s.semI2) return { texto: 'Os agentes dos setores passam a atender quando a atualização do banco da Parte I2 for aplicada.', aviso: true };
  if (!s.tipos.includes('conversa')) return { texto: 'Tarefas de trabalho chegam na próxima etapa.', aviso: false };
  if (s.estado === 'desligado') return { texto: 'Desligado: o Thiago atende como sempre.', aviso: false };
  if (!s.modo) return { texto: 'Escolha como fala com o cliente: sem isso o agente não atende.', aviso: true };
  if (s.estado === 'teste') return { texto: `Em teste: atende só os contatos da lista (${s.contatosTeste}). Com os outros, o Thiago segue como sempre.`, aviso: false };
  return { texto: `Ligado: atende quando o Thiago identifica um assunto do setor ${s.setor ?? 'do agente'}.`, aviso: false };
}

export function FaixaComoAtua({ situacao }: { situacao: SituacaoAgente }) {
  const { texto, aviso } = textoComoAtua(situacao);
  const Icone = aviso ? TriangleAlert : Info;
  return (
    <p className={aviso
      ? 'flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning'
      : 'flex items-start gap-2 rounded-md border border-info bg-info-soft px-4 py-3 text-sm text-info'}>
      <Icone aria-hidden size={16} className="mt-0.5 shrink-0" />
      {texto}
    </p>
  );
}

/** D23: homologação sem a migração. */
export function FaixaSemMigracao() {
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">
      <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
      Os agentes aparecem quando a atualização do banco da Parte I for aplicada. Até lá, só as orientações e o teste do Thiago funcionam.
    </p>
  );
}
