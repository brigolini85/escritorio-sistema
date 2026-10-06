// Revisão geral I2: o giro do Radar para de abrir rodadas no prazo (PRAZO_GIRO_MS), antes de o banco fechar o giro travado
// (40 min) e de o job da fila expirar; antes, até 12 rodadas x 2 x 300 s podiam rodar junto com o giro seguinte.
import type Anthropic from '@anthropic-ai/sdk';
import type { GiroParaRodar, Repos, ReposRadar } from '@escritorio/db';
import { describe, expect, it, vi } from 'vitest';
import { PRAZO_GIRO_MS, rodarGiro } from '../../src/radar/giro';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

const PRECO = { entrada: 3, saida: 15, cacheLeitura: 0.3, cacheEscrita: 3.75 };
const resposta = (content: unknown[], stop: string): Anthropic.Message => ({
  id: 'msg_x', type: 'message', role: 'assistant', model: 'claude-sonnet-5', content, stop_reason: stop, stop_sequence: null,
  usage: { input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 0 } },
} as unknown as Anthropic.Message);
const usar = (nome: string, entrada: object) => ({ type: 'tool_use', id: `toolu_${nome}_${Math.random()}`, name: nome, input: entrada });

const giro: GiroParaRodar = {
  id: 'g1', origem: 'pedido', pedidoPor: 'u1', novidade: null,
  config: { hora: '07:00', dias: [0, 1, 2, 3, 4, 5, 6], assuntos: ['eSocial'], resumoWhatsapp: true, avisoAlto: true, avisarPainel: false, limiteUsdGiro: 50 },
  fontes: [{ id: 'f', nome: 'eSocial', dominio: 'gov.br', caminho: '/esocial', etiqueta: 'FED', oficial: true, ativa: true, paginas: [] }],
  setores: [{ id: 's', nome: 'Pessoal' }], recentes: [],
};

describe('rodarGiro: prazo', () => {
  it('passado o prazo, não abre outra rodada e o giro fecha com o motivo', async () => {
    let agora = 0;
    const repos = {
      obterConfiguracoes: vi.fn(async () => ({ tetoIaUsd: 100, modeloConversa: 'claude-sonnet-5', precosModelos: { 'claude-sonnet-5': PRECO } })),
      custoIaDoMes: vi.fn(async () => 0),
      perfilDoAgente: vi.fn(async () => ({ id: 'a', slug: 'radar', nome: 'Radar', modelo: null, ferramentas: [], skills: [], skillEmTeste: null })),
      orientacoesAtivas: vi.fn(async () => []),
      registrarUsoIa: vi.fn(async () => undefined),
    };
    const radar = { somarCustoGiro: vi.fn(async () => undefined), registrarFonteFora: vi.fn(async () => undefined) };
    const ia = new IaRoteirizada([
      resposta([usar('fonte_fora_do_ar', { fonte: 'eSocial', detalhe: 'x' })], 'tool_use'),
      resposta([usar('fonte_fora_do_ar', { fonte: 'eSocial', detalhe: 'y' })], 'tool_use'),
      resposta([usar('terminar_giro', { resumo: 'Nada.' })], 'tool_use'),
    ]);
    const original = ia.criar.bind(ia);
    ia.criar = async (p) => { const r = await original(p); agora += PRAZO_GIRO_MS + 1; return r; };
    const r = await rodarGiro({ repos: repos as unknown as Repos, radar: radar as unknown as ReposRadar, ia, relogio: () => new Date('2026-10-26T13:00:00Z'),
      agoraMs: () => agora }, giro);
    expect(ia.recebidos).toHaveLength(1);
    expect(r.estado).toBe('concluido');
    expect(r.resumo).toContain('Parou no tempo máximo do giro.');
  });
});
