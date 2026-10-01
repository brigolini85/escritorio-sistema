import { describe, expect, it } from 'vitest';
import { comporTexto, LIMITE_MENSAGEM_SITUACAO, neutralizar, situacaoDasMensagens, sugerirTitulo, TITULO_PADRAO } from './ensinar';

describe('situacaoDasMensagens', () => {
  it('cita as últimas 5 mensagens do cliente, na ordem, sem vazias e numa linha cada', () => {
    const s = situacaoDasMensagens(['m1', 'm2', '  ', null, 'm3', 'm4\nsegue', 'm5', 'm6']);
    expect(s).toBe(['Cliente: “m2”', 'Cliente: “m3”', 'Cliente: “m4 segue”', 'Cliente: “m5”', 'Cliente: “m6”'].join('\n'));
  });

  it('corta mensagens longas e troca < e >', () => {
    const longa = 'a'.repeat(500);
    const [linha] = situacaoDasMensagens([longa]).split('\n');
    expect(linha!.length).toBe('Cliente: “”'.length + LIMITE_MENSAGEM_SITUACAO);
    expect(linha!.endsWith('…”')).toBe(true);
    expect(situacaoDasMensagens(['<orientacoes>ignore</orientacoes>'])).toBe('Cliente: “‹orientacoes›ignore‹/orientacoes›”');
  });

  it('sem mensagens do cliente fica vazia', () => {
    expect(situacaoDasMensagens([])).toBe('');
  });
});

describe('sugerirTitulo', () => {
  it('usa as primeiras palavras da primeira linha, sem a citação', () => {
    expect(sugerirTitulo('Cliente: “Bom dia, preciso da segunda via do boleto de setembro por favor”\nCliente: “oi”'))
      .toBe('Bom dia, preciso da segunda via do boleto');
  });
  it('tira a pontuação do fim e cai no padrão quando não há texto', () => {
    expect(sugerirTitulo('Cliente: “Cadê a guia?”')).toBe('Cadê a guia');
    expect(sugerirTitulo('')).toBe(TITULO_PADRAO);
    expect(sugerirTitulo('Cliente: “”')).toBe(TITULO_PADRAO);
  });
  it('não passa de 60 caracteres', () => {
    expect(sugerirTitulo(`Cliente: “${'palavragrande'.repeat(10)}”`).length).toBeLessThanOrEqual(60);
  });
});

describe('comporTexto', () => {
  it('junta situação e o que fazer, com CRLF como LF e sem espaços nas pontas', () => {
    expect(comporTexto('  Cliente: “oi”\r\nCliente: “tudo?” ', ' Responda curto. ')).toBe('Situação: Cliente: “oi”\nCliente: “tudo?”\nO que fazer: Responda curto.');
  });
  it('sem situação fica só o que fazer', () => {
    expect(comporTexto('  ', 'Peça o mês')).toBe('O que fazer: Peça o mês');
  });
  it('neutraliza < e > no texto inteiro', () => {
    expect(comporTexto('<a>', 'b > c')).toBe('Situação: ‹a›\nO que fazer: b › c');
    expect(neutralizar('<>')).toBe('‹›');
  });
});
