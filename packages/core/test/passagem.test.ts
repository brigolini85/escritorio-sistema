import { describe, expect, it } from 'vitest';
import { FUNCIONALIDADES_IA, MOTIVOS_PASSAGEM, ehPedidoDoCliente, motivoDaEscalada } from '../src';

describe('motivos da passagem (spec 7A.2)', () => {
  it('escalada do agente vira texto da tela', () => {
    expect(motivoDaEscalada('refusal')).toBe('o modelo se recusou a responder');
    expect(motivoDaEscalada('max_tokens')).toBe('a resposta ficou longa demais');
    expect(motivoDaEscalada('terminou sem responder')).toBe('o agente terminou sem responder');
    expect(motivoDaEscalada('limite de iterações')).toBe('o agente passou do número máximo de passos');
    expect(motivoDaEscalada('qualquer outra coisa')).toBe('o agente não conseguiu concluir');
  });

  it('reconhece o pedido do cliente só pelo texto exato', () => {
    expect(ehPedidoDoCliente(MOTIVOS_PASSAGEM.pedidoCliente)).toBe(true);
    expect(ehPedidoDoCliente(MOTIVOS_PASSAGEM.naoEntendeu)).toBe(false);
    expect(ehPedidoDoCliente(null)).toBe(false);
  });

  it('todos os motivos cabem na coluna (300) e nenhum é vazio', () => {
    for (const m of Object.values(MOTIVOS_PASSAGEM)) expect(m.length).toBeGreaterThan(0);
    for (const m of Object.values(MOTIVOS_PASSAGEM)) expect(m.length).toBeLessThanOrEqual(300);
  });

  it('funcionalidades de IA iguais às da regra do banco (20261005000400)', () => {
    expect(FUNCIONALIDADES_IA).toEqual(['agente_clientes', 'assistente_site', 'assistente_whatsapp', 'sugerir_resposta',
      'testar_agente', 'transcricao_audio', 'especialista_setor', 'nao_identificado']);
  });
});
