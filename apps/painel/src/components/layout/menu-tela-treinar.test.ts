import { describe, expect, it } from 'vitest';
import { menuRecolhidoVisivel, telaComMenuRecolhido, telaRecolhida } from './menu-tela';

describe('menu recolhido também no Treinar o agente (spec 7C.5, D18)', () => {
  it('Treinar o agente recolhe (a consulta da URL não entra no caminho)', () => {
    expect(telaComMenuRecolhido('/treinar-agente')).toBe(true);
    expect(telaComMenuRecolhido('/treinar-agentes')).toBe(false);
    expect(menuRecolhidoVisivel('/treinar-agente', false, false)).toBe(true);
    expect(menuRecolhidoVisivel('/treinar-agente', false, true)).toBe(false);
  });
  it('telaRecolhida separa o Treinar das outras telas recolhidas', () => {
    expect(telaRecolhida('/treinar-agente')).toBe('treinar-agente');
    expect(telaRecolhida('/assistente')).toBe('assistente');
    expect(telaRecolhida('/configuracoes')).toBeNull();
  });
});
