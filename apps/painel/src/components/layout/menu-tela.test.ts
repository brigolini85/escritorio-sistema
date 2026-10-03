import { describe, expect, it } from 'vitest';
import { menuRecolhidoVisivel, telaComMenuRecolhido } from './menu-tela';

describe('menu recolhido nas telas de três colunas (spec 4.3, P17)', () => {
  it('Atendimento e conversa aberta', () => {
    expect(telaComMenuRecolhido('/atendimento')).toBe(true);
    expect(telaComMenuRecolhido('/atendimento/abc')).toBe(true);
    expect(telaComMenuRecolhido('/atendimentos')).toBe(false);
    expect(telaComMenuRecolhido('/demandas')).toBe(false);
  });
  it('no Atendimento vale o "aberto nesta tela"; fora dele, a preferência guardada', () => {
    expect(menuRecolhidoVisivel('/atendimento', false, false)).toBe(true);
    expect(menuRecolhidoVisivel('/atendimento', false, true)).toBe(false);
    expect(menuRecolhidoVisivel('/demandas', false, true)).toBe(false);
    expect(menuRecolhidoVisivel('/demandas', true, false)).toBe(true);
  });
});
