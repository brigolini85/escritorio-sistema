import { describe, expect, it } from 'vitest';
import { linhasCsvGastos } from './gastos-csv';

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
});
