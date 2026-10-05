import { describe, expect, it } from 'vitest';
import { ABAS_AGENTE, abaAtual, hrefAba } from './ficha';

describe('abas da ficha do agente (spec 7E.3, D20)', () => {
  it('as 7 abas, na ordem da imagem', () => {
    expect(ABAS_AGENTE.map((a) => a.rotulo)).toEqual(['Visão geral', 'Skills', 'Ferramentas', 'Como fala com o cliente', 'Orientações', 'Testar', 'Atividade e custo']);
  });
  it('aba pelo caminho; o endereço de cada uma', () => {
    expect(abaAtual('/agentes/fiscal', 'fiscal')).toBe('');
    expect(abaAtual('/agentes/fiscal/skills', 'fiscal')).toBe('skills');
    expect(abaAtual('/agentes/fiscal/coisa', 'fiscal')).toBe('');
    expect(hrefAba('fiscal', '')).toBe('/agentes/fiscal');
    expect(hrefAba('fiscal', 'como-fala')).toBe('/agentes/fiscal/como-fala');
  });
});
