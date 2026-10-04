import { describe, expect, it } from 'vitest';
import { menuRecolhidoVisivel, telaComMenuRecolhido, telaRecolhida } from './menu-tela';

describe('menu recolhido também no Assistente (spec 7C.3, D13)', () => {
  it('Assistente, com ou sem consulta na URL (o caminho não leva a consulta)', () => {
    expect(telaComMenuRecolhido('/assistente')).toBe(true);
    expect(telaComMenuRecolhido('/assistentes')).toBe(false);
    expect(menuRecolhidoVisivel('/assistente', false, false)).toBe(true);
    expect(menuRecolhidoVisivel('/assistente', false, true)).toBe(false);
  });
  it('telaRecolhida separa Atendimento e Assistente: trocar de uma para a outra esquece o "aberto aqui"', () => {
    expect(telaRecolhida('/atendimento')).toBe('atendimento');
    expect(telaRecolhida('/atendimento/abc')).toBe('atendimento');
    expect(telaRecolhida('/assistente')).toBe('assistente');
    expect(telaRecolhida('/demandas')).toBeNull();
  });
});
