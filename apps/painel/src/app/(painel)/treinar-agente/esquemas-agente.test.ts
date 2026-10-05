import { describe, expect, it } from 'vitest';
import { destinoDaTela, slugDoDestino } from './esquemas';

describe('orientações por agente (D21)', () => {
  it('a tela de cada agente é destino válido; o resto volta para /treinar-agente', () => {
    expect(destinoDaTela('/agentes/fiscal/orientacoes?orientacao=nova')).toBe('/agentes/fiscal/orientacoes?orientacao=nova');
    expect(destinoDaTela('/agentes/fiscal/skills')).toBe('/treinar-agente');
    expect(destinoDaTela('https://outro.site/agentes/fiscal/orientacoes')).toBe('/treinar-agente');
  });
  it('o agente das orientações sai do endereço; /treinar-agente é o Thiago', () => {
    expect(slugDoDestino('/agentes/fiscal/orientacoes?ativo=ligadas')).toBe('fiscal');
    expect(slugDoDestino('/treinar-agente?orientacao=nova')).toBe('atendimento');
  });
});
