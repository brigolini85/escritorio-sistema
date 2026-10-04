// Frase de cada evento da demanda (imagem 05: "Agente abriu", "Sistema prazo 01/10 17h").
import { ROTULO_PRIORIDADE, ROTULO_STATUS, type Prioridade, type StatusFiltro } from './demandas';
import { prazoAbsoluto } from './prazo';

/** Evento de chamado_eventos, com o nome de quem fez (usuarios.nome). */
export type EventoDemanda = { tipo: string; texto: string | null; criado_em: string; usuario: string | null };

/** Sem pessoa: a abertura e a prioridade são do agente (ou do sistema); o resto é do Sistema; nota sem pessoa é do agente. */
export function fraseDoEvento(e: EventoDemanda, origem: string): { ator: string; acao: string; detalhe: string | null } {
  const robo = origem === 'equipe' ? 'Equipe' : origem === 'sistema' ? 'Sistema' : 'Agente';
  const ator = (semPessoa: string) => e.usuario ?? semPessoa;
  const so = (semPessoa: string, acao: string) => ({ ator: ator(semPessoa), acao, detalhe: null });
  switch (e.tipo) {
    case 'criacao': return so(robo, 'abriu');
    case 'prioridade_alterada': return so(robo, `prioridade ${ROTULO_PRIORIDADE[e.texto as Prioridade] ?? e.texto ?? ''}`.trim());
    case 'prazo_alterado': return so('Sistema', e.texto ? `prazo ${prazoAbsoluto(e.texto)}` : 'tirou o prazo');
    case 'prazo_recalculado':
      return { ator: 'Sistema', acao: `prazo ${prazoAbsoluto(e.texto ?? '')} · recalculado por mudança de regra (${e.usuario ?? 'Sistema'})`, detalhe: null };
    case 'assumido': return so('Sistema', 'assumiu');
    case 'status_alterado': return so('Sistema', `status ${ROTULO_STATUS[e.texto as StatusFiltro] ?? e.texto ?? ''}`.trim());
    case 'responsavel_alterado': return so('Sistema', e.texto ? `responsável ${e.texto}` : 'tirou o responsável');
    case 'transferencia': return so('Sistema', `transferiu para ${e.texto ?? 'Triagem'}`);
    case 'editado': return so('Sistema', `editou ${e.texto ?? ''}`.trim());
    case 'conclusao': return so('Sistema', 'concluiu');
    case 'reaberto': return so('Sistema', 'reabriu');
    case 'nota_interna': return { ator: ator('Agente'), acao: 'nota interna', detalhe: e.texto };
    default: return { ator: ator('Sistema'), acao: e.tipo, detalhe: e.texto };
  }
}
