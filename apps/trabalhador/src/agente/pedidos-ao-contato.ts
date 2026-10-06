import type { PedidoAoContato } from '@escritorio/db';
import { limparTextoOrientacao } from './orientacoes';

/** Parte I3a (D26): o que a equipe pediu a este contato por aqui. Fora do bloco com cache (depende do contato). */
export const CABECALHO_PEDIDOS_AO_CONTATO =
  'PEDIDOS DO ESCRITÓRIO A ESTE CONTATO (valem só nesta conversa). A equipe pediu, por aqui, o que está abaixo. Se o cliente responder sobre isso '
  + 'ou mandar o arquivo, agradeça, diga que vai passar para a equipe e não abra demanda nova para isso: a pessoa do setor confere. Se ele disser '
  + 'que não tem ou que vai demorar, agradeça e diga que vai avisar a equipe. Não cobre de novo por conta própria.';

const limpo = (t: string) => limparTextoOrientacao(t).replace(/\s+/g, ' ').trim();

/** null sem pedido: o pedido do Thiago fica igual ao de antes (retratos da I1). */
export function secaoPedidosAoContato(pedidos: readonly PedidoAoContato[]): string | null {
  if (!pedidos.length) return null;
  return `${CABECALHO_PEDIDOS_AO_CONTATO}\n${pedidos.map((p) => `- ${limpo(p.pergunta)} (demanda nº ${p.chamadoNumero}`
    + `${p.setor ? `, setor ${limpo(p.setor)}` : ''}${p.empresa ? `, empresa ${limpo(p.empresa)}` : ''})`).join('\n')}`;
}
