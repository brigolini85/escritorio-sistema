import { describe, expect, it } from 'vitest';
import { lerConversa, type MensagemTela } from './resultados-assistente';

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const corpo = (q: number) => `• ${q} PAC Pão de queijo (cód. 12) × R$ 18,50 = R$ ${(q * 18.5).toFixed(2).replace('.', ',')}\nTotal: R$ ${(q * 18.5).toFixed(2).replace('.', ',')}`;
const previa = (n: number, antes: number, depois: number) => `Prévia do pedido #${n}:\nAntes:\n${corpo(antes)}\nDepois:\n${corpo(depois)}\n\nResponda sim para gravar.`;
const msg = (i: number, papel: 'usuario' | 'assistente', conteudo: string): MensagemTela =>
  ({ id: ID(i), papel, conteudo, arquivo: null, processada_em: `2026-10-01T15:0${i}:00Z`, criado_em: `2026-10-01T15:0${i}:00Z` });

describe('cartão de uma prévia antiga do mesmo pedido', () => {
  it('não mostra a contagem da prévia antiga: diz que o painel mostra a mais recente', () => {
    const l = lerConversa([
      msg(1, 'assistente', previa(536, 10, 15)),
      msg(2, 'usuario', 'não, 12'),
      msg(3, 'assistente', previa(536, 10, 12)),
    ], true);
    expect(l.respostas.get(ID(1))).toContainEqual({ tipo: 'cartao', cartao: { tipo: 'pedido', chave: 'pedido-536', rotulo: 'Prévia #536 anterior · o painel mostra a mais recente' } });
    expect(l.respostas.get(ID(3))).toContainEqual({ tipo: 'cartao', cartao: { tipo: 'pedido', chave: 'pedido-536', rotulo: 'Prévia #536 · 1 alteração' } });
  });

  it('duas prévias do mesmo pedido na mesma resposta: só a última é a mostrada', () => {
    const l = lerConversa([msg(1, 'assistente', `${previa(536, 10, 15)}\n\n${previa(536, 10, 12)}`)], true);
    const cartoes = (l.respostas.get(ID(1)) ?? []).filter((p) => p.tipo === 'cartao').map((p) => p.tipo === 'cartao' && p.cartao.rotulo);
    expect(cartoes).toEqual(['Prévia #536 anterior · o painel mostra a mais recente', 'Prévia #536 · 1 alteração']);
  });
});
