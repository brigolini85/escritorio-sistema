import { describe, expect, it } from 'vitest';
import {
  formatarBRL, formatarData, formatarDataHora, formatarHora, formatarNumero, isoOuNulo, tipoDocumento, mascararCEP, mascararCNPJ, mascararCPF, mascararDocumento, mascararTelefone,
  NBSP, tempoRelativo,
} from './formatos';

const sem = (t: string) => t.replaceAll(NBSP, ' ');

describe('formatarBRL', () => {
  it('reais com milhar, centavos e espaço que não quebra', () => {
    expect(formatarBRL(1280)).toBe(`R$${NBSP}1.280,00`);
    expect(formatarBRL(1280).charCodeAt(2)).toBe(0xa0);
    expect(sem(formatarBRL(9.5))).toBe('R$ 9,50');
    expect(sem(formatarBRL(142.5))).toBe('R$ 142,50');
    expect(sem(formatarBRL(1234567.891))).toBe('R$ 1.234.567,89');
    expect(sem(formatarBRL(0))).toBe('R$ 0,00');
  });
  it('arredonda para centavos e trata negativo', () => {
    expect(sem(formatarBRL(0.1 + 0.2))).toBe('R$ 0,30');
    expect(sem(formatarBRL(-9.5))).toBe('-R$ 9,50');
    expect(sem(formatarBRL(-0.001))).toBe('R$ 0,00');
  });
});

describe('formatarNumero', () => {
  it('quantidades com vírgula e até 3 casas', () => {
    expect(formatarNumero(15)).toBe('15');
    expect(formatarNumero(1.5)).toBe('1,5');
    expect(formatarNumero(1234.25)).toBe('1.234,25');
    expect(formatarNumero(0.3333333)).toBe('0,333');
  });
});

describe('máscaras', () => {
  it('CNPJ, CPF e documento pelo tamanho', () => {
    expect(mascararCNPJ('11222333000181')).toBe('11.222.333/0001-81');
    expect(mascararCNPJ('11.222.333/0001-81')).toBe('11.222.333/0001-81');
    expect(mascararCPF('12345678909')).toBe('123.456.789-09');
    expect(mascararDocumento('11222333000181')).toBe('11.222.333/0001-81');
    expect(mascararDocumento('123.456.789-09')).toBe('123.456.789-09');
  });
  it('CNPJ alfanumérico (Receita, jul/2026): 12 letras/números + 2 dígitos', () => {
    expect(mascararCNPJ('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
    expect(mascararCNPJ('12.abc.345/01de-35')).toBe('12.ABC.345/01DE-35');
    expect(mascararDocumento('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
    expect(tipoDocumento('12ABC34501DE35')).toBe('cnpj');
    expect(tipoDocumento('123.456.789-09')).toBe('cpf');
    expect(tipoDocumento('12ABC34501DEXY')).toBeNull(); // dígitos verificadores têm de ser números
    expect(mascararCNPJ('12ABC34501DEXY')).toBe('12ABC34501DEXY');
  });
  it('tamanho errado volta como veio (não inventa dígitos)', () => {
    expect(mascararCNPJ('1122233300018')).toBe('1122233300018');
    expect(mascararDocumento(' 123 ')).toBe('123');
  });
  it('CEP', () => {
    expect(mascararCEP('30110000')).toBe('30110-000');
    expect(mascararCEP('30110-000')).toBe('30110-000');
    expect(mascararCEP('3011')).toBe('3011');
  });
  it('telefone com ou sem 55, celular e fixo', () => {
    expect(mascararTelefone('5531998765432')).toBe('(31) 99876-5432');
    expect(mascararTelefone('31998765432')).toBe('(31) 99876-5432');
    expect(mascararTelefone('553132221100')).toBe('(31) 3222-1100');
    expect(mascararTelefone('3132221100')).toBe('(31) 3222-1100');
    expect(mascararTelefone('+1 555 0100')).toBe('+1 555 0100');
  });
});

describe('datas no horário de Brasília', () => {
  it('data e data com hora', () => {
    // 17:05 UTC = 14:05 em Brasília (UTC-3, sem horário de verão)
    expect(formatarDataHora('2026-09-30T17:05:00Z')).toBe('30/09/2026 às 14:05');
    expect(formatarData('2026-09-30T17:05:00Z')).toBe('30/09/2026');
    expect(formatarHora('2026-09-30T03:07:00Z')).toBe('00:07');
    // 01:30 UTC do dia 1º ainda é dia 30 em Brasília
    expect(formatarDataHora('2026-10-01T01:30:00Z')).toBe('30/09/2026 às 22:30');
  });
});

describe('tempoRelativo', () => {
  const agora = new Date('2026-09-30T17:00:00Z');
  const antes = (s: number) => new Date(agora.getTime() - s * 1000);
  it('segundos, minutos, horas e dias', () => {
    expect(tempoRelativo(antes(2), agora)).toBe('agora');
    expect(tempoRelativo(antes(40), agora)).toBe('há 40s');
    expect(tempoRelativo(antes(3 * 60 + 10), agora)).toBe('há 3 min');
    expect(tempoRelativo(antes(2 * 3600), agora)).toBe('há 2 h');
    expect(tempoRelativo(antes(26 * 3600), agora)).toBe('há 1 dia');
    expect(tempoRelativo(antes(5 * 86400), agora)).toBe('há 5 dias');
  });
  it('a partir de 7 dias mostra a data de Brasília', () => {
    expect(tempoRelativo('2026-09-12T02:00:00Z', agora)).toBe('11/09/2026');
  });
  it('futuro: relógio adiantado vira "agora"; mais longe, "em"', () => {
    expect(tempoRelativo(new Date(agora.getTime() + 30_000), agora)).toBe('agora');
    expect(tempoRelativo(new Date(agora.getTime() + 5 * 60_000), agora)).toBe('em 5 min');
  });
  it('data inválida vira texto vazio (não lança)', () => {
    expect(tempoRelativo('nada', agora)).toBe('');
    expect(formatarDataHora('nada')).toBe('');
    expect(formatarData(new Date(Number.NaN))).toBe('');
    expect(formatarHora('')).toBe('');
    expect(isoOuNulo('nada')).toBeNull();
    expect(isoOuNulo('2026-09-30T17:05:00Z')).toBe('2026-09-30T17:05:00.000Z');
  });
});
