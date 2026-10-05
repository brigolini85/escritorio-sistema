import { describe, expect, it } from 'vitest';
import { telaComMenuRecolhido } from './menu-tela';
import { trilhaDaRota } from './trilha';

describe('Agentes no menu e na trilha (spec 7E.1, D20)', () => {
  it('Orientações e Testar abrem com o menu recolhido (três colunas); as outras abas, não', () => {
    expect(telaComMenuRecolhido('/agentes/atendimento/orientacoes')).toBe(true);
    expect(telaComMenuRecolhido('/agentes/fiscal/testar')).toBe(true);
    expect(telaComMenuRecolhido('/agentes/fiscal/skills')).toBe(false);
    expect(telaComMenuRecolhido('/agentes')).toBe(false);
  });
  it('trilha: Administração › Agentes; na ficha, Agentes vira link', () => {
    expect(trilhaDaRota('/agentes')).toEqual([{ rotulo: 'Administração' }, { rotulo: 'Agentes' }]);
    expect(trilhaDaRota('/agentes/fiscal/skills')).toEqual([{ rotulo: 'Administração' }, { rotulo: 'Agentes', href: '/agentes' }, { rotulo: 'Agente' }]);
  });
});
