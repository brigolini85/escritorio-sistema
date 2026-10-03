import { describe, expect, it, vi } from 'vitest';
import { LIMITE_EXPORTAR, ateCongelado, lerTodasChamadas, linhasCsvGastos } from './gastos-csv';

const linha = {
  id: '1', criado_em: '2026-09-26T13:05:00Z', funcionalidade: 'testar_agente', usuario_id: 'u', pessoa: 'Thiago', cliente_id: null, empresa: null,
  conversa_id: null, modelo: 'claude-sonnet-5', provedor: 'anthropic', tokens_entrada: 1200, tokens_saida: 300, tokens_cache_leitura: 5000,
  tokens_cache_escrita: 0, segundos_audio: null, custo_usd: 0.0123,
};

describe('linhasCsvGastos', () => {
  it('BOM, ponto e vírgula, cabeçalho em português, data de Brasília, vírgula decimal', () => {
    const csv = linhasCsvGastos([linha], 5.5);
    expect(csv.startsWith('﻿')).toBe(true);
    const [cab, l1] = csv.slice(1).trimEnd().split('\r\n');
    expect(cab).toBe('Data e hora;Funcionalidade;Pessoa;Empresa;Modelo;Provedor;Tokens de entrada;Tokens de saída;Tokens lidos do cache;Tokens gravados no cache;Segundos de áudio;Custo (US$);Custo (R$)');
    // formatarDataHora (formato da casa) escreve "dd/mm/aaaa às hh:mm".
    expect(l1).toBe('26/09/2026 às 10:05;Testar o agente;Thiago;;claude-sonnet-5;anthropic;1200;300;5000;0;;0,012300;0,07');
  });
  it('sem cotação: sem a coluna R$; texto com ; ou aspas vai entre aspas', () => {
    const csv = linhasCsvGastos([{ ...linha, empresa: 'Rede "Bom"; Preço' }], null);
    expect(csv).not.toContain('Custo (R$)');
    expect(csv).toContain('"Rede ""Bom""; Preço"');
  });
  it('quebra de linha no texto vai entre aspas (não quebra a linha do arquivo)', () => {
    const csv = linhasCsvGastos([{ ...linha, empresa: 'Rede\nBom' }], null);
    expect(csv).toContain('"Rede\nBom"');
    expect(csv.slice(1).trimEnd().split('\r\n')).toHaveLength(2);
  });
  it('fórmula no começo do texto vira texto (=, +, -, @, tab)', () => {
    expect(linhasCsvGastos([{ ...linha, pessoa: '=HYPERLINK("x")' }], null)).toContain(`"'=HYPERLINK(""x"")"`);
    expect(linhasCsvGastos([{ ...linha, pessoa: '+5531999990000' }], null)).toContain(`"'+5531999990000"`);
    expect(linhasCsvGastos([{ ...linha, empresa: '-2+3' }], null)).toContain(`"'-2+3"`);
    expect(linhasCsvGastos([{ ...linha, empresa: '@SOMA(A1)' }], null)).toContain(`"'@SOMA(A1)"`);
    expect(linhasCsvGastos([{ ...linha, empresa: '\t=1' }], null)).toContain(`"'\t=1"`);
  });
  it('números vindos como texto do PostgREST e áudio com segundos', () => {
    const csv = linhasCsvGastos([{ ...linha, funcionalidade: 'transcricao_audio', custo_usd: '0.5' as never, segundos_audio: '90' as never }], 2);
    expect(csv).toContain(';Transcrição de áudio;');
    expect(csv.trimEnd().endsWith(';90,00;0,500000;1,00')).toBe(true);
  });
  it('funcionalidade desconhecida aparece como "Não identificado"', () => {
    expect(linhasCsvGastos([{ ...linha, funcionalidade: 'xyz' }], null)).toContain(';Não identificado;');
  });
  it('sem linhas: só o cabeçalho', () => {
    expect(linhasCsvGastos([], null).slice(1).trimEnd().split('\r\n')).toHaveLength(1);
  });
  it('no limite de 100.000 chamadas o corte aparece na última linha; abaixo dele, não', () => {
    const cheio = Array.from({ length: LIMITE_EXPORTAR }, () => linha);
    const linhas = linhasCsvGastos(cheio, null).slice(1).trimEnd().split('\r\n');
    expect(linhas).toHaveLength(LIMITE_EXPORTAR + 2);
    expect(linhas.at(-1)).toBe('Arquivo cortado em 100.000 chamadas. Escolha um período menor.');
    expect(linhasCsvGastos(cheio.slice(1), null)).not.toContain('Arquivo cortado');
  });
});

describe('lerTodasChamadas', () => {
  const paginaDe = (total: number) => vi.fn(async (inicio: number, fim: number) => ({
    data: Array.from({ length: Math.max(0, Math.min(fim, total - 1) - inicio + 1) }, (_, i) => ({ ...linha, id: String(inicio + i) })), error: null,
  }));
  it('pede de 1000 em 1000 até vir uma página incompleta', async () => {
    const pagina = paginaDe(2205);
    const r = await lerTodasChamadas(pagina);
    expect(r.error).toBeNull();
    expect(r.linhas).toHaveLength(2205);
    expect(new Set(r.linhas.map((l) => l.id)).size).toBe(2205);
    expect(pagina.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('múltiplo exato de 1000: uma página vazia encerra', async () => {
    const pagina = paginaDe(2000);
    expect((await lerTodasChamadas(pagina)).linhas).toHaveLength(2000);
    expect(pagina).toHaveBeenCalledTimes(3);
  });
  it('para no limite de 100.000', async () => {
    const pagina = paginaDe(150_000);
    expect((await lerTodasChamadas(pagina)).linhas).toHaveLength(LIMITE_EXPORTAR);
    expect(pagina).toHaveBeenCalledTimes(100);
  });
  it('erro numa página: devolve o erro (nada de arquivo pela metade)', async () => {
    const pagina = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => linha), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    expect(await lerTodasChamadas(pagina)).toEqual({ linhas: [], error: { message: 'x' } });
  });
});

// Revisão final (M1): o fim do período é fixado uma vez antes das páginas; chamada nova no meio não empurra as páginas.
describe('ateCongelado', () => {
  const periodo = { de: '2026-10-01T00:00:00-03:00', ate: '2026-11-01T00:00:00-03:00' };
  it('período que inclui agora: o fim vira o instante do pedido', () => {
    expect(ateCongelado(periodo, new Date('2026-10-03T15:00:00Z'))).toBe('2026-10-03T15:00:00.000Z');
  });
  it('período todo no passado: o fim continua o do período', () => {
    expect(ateCongelado(periodo, new Date('2026-12-01T00:00:00Z'))).toBe(periodo.ate);
  });
  it('período todo no futuro: não fica com o fim antes do começo (o banco recusaria)', () => {
    expect(ateCongelado(periodo, new Date('2026-09-01T00:00:00Z'))).toBe(periodo.ate);
  });
});
