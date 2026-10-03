import { describe, expect, it } from 'vitest';
import {
  INFO_FUNCIONALIDADE, ORDEM_EMPILHADO, emReais, formatarUsdFino, iniciais, lerPeriodo, montarRanking, percentual, previsaoFechamento, textoDiaMaisCaro, lerEmpresaAberta, lerPessoaAberta,
} from './gastos';
import { FUNCIONALIDADES_IA } from '@escritorio/core';

const AGORA = new Date('2026-10-15T15:00:00Z'); // 15/10 12:00 de Brasília

describe('lerPeriodo', () => {
  it('padrão: este mês, de 1º até o fim do mês (Brasília)', () => {
    expect(lerPeriodo({}, AGORA)).toMatchObject({ filtro: 'mes', de: '2026-10-01T00:00:00-03:00', ate: '2026-11-01T00:00:00-03:00', rotulo: 'outubro', aviso: null });
  });
  it('hoje, 7 dias e mês passado', () => {
    expect(lerPeriodo({ p: 'hoje' }, AGORA)).toMatchObject({ de: '2026-10-15T00:00:00-03:00', ate: '2026-10-16T00:00:00-03:00', dias: 1 });
    expect(lerPeriodo({ p: '7d' }, AGORA)).toMatchObject({ de: '2026-10-09T00:00:00-03:00', ate: '2026-10-16T00:00:00-03:00', dias: 7 });
    expect(lerPeriodo({ p: 'mes-passado' }, AGORA)).toMatchObject({ de: '2026-09-01T00:00:00-03:00', ate: '2026-10-01T00:00:00-03:00', rotulo: 'setembro' });
  });
  it('janeiro: mês passado é dezembro do ano anterior', () => {
    expect(lerPeriodo({ p: 'mes-passado' }, new Date('2027-01-10T15:00:00Z'))).toMatchObject({ de: '2026-12-01T00:00:00-03:00', ate: '2027-01-01T00:00:00-03:00' });
  });
  it('período: datas inclusive; "até" vira o dia seguinte exclusivo', () => {
    expect(lerPeriodo({ p: 'periodo', de: '2026-09-20', ate: '2026-09-24' }, AGORA))
      .toMatchObject({ de: '2026-09-20T00:00:00-03:00', ate: '2026-09-25T00:00:00-03:00', dias: 5, rotulo: '20/09 a 24/09' });
  });
  it('período inválido, invertido ou maior que 366 dias: volta para este mês com aviso', () => {
    for (const p of [{ de: 'x', ate: '2026-09-24' }, { de: '2026-09-24', ate: '2026-09-20' }, { de: '2025-01-01', ate: '2026-09-20' }]) {
      expect(lerPeriodo({ p: 'periodo', ...p }, AGORA)).toMatchObject({ filtro: 'mes', aviso: 'Período inválido: mostrando este mês.' });
    }
  });
});

describe('previsaoFechamento', () => {
  it('gasto ÷ dias corridos (contando hoje) × dias do mês', () => {
    expect(previsaoFechamento(15, AGORA)).toBeCloseTo(31, 6); // 15 em 15 dias de outubro (31 dias)
  });
  it('dia 1º conta como um dia', () => expect(previsaoFechamento(2, new Date('2026-10-01T15:00:00Z'))).toBeCloseTo(62, 6));
});

describe('cores e nomes', () => {
  it('toda funcionalidade tem nome, ícone e cor; o empilhado tem ordem fixa', () => {
    for (const f of FUNCIONALIDADES_IA) expect(INFO_FUNCIONALIDADE[f].rotulo.length).toBeGreaterThan(0);
    expect(ORDEM_EMPILHADO).toEqual(['assistente_site', 'sugerir_resposta', 'testar_agente', 'assistente_whatsapp']);
    expect(INFO_FUNCIONALIDADE.agente_clientes.rotulo).toBe('Agente de clientes');
    expect(INFO_FUNCIONALIDADE.nao_identificado.rotulo).toBe('Não identificado');
  });
});

describe('montarRanking', () => {
  const l = (usuario_id: string, nome: string, funcionalidade: string, custo_usd: number, chamadas = 1) => ({ usuario_id, nome, funcionalidade, custo_usd, chamadas });
  it('soma por pessoa, % do total das pessoas, partes na ordem fixa (não por tamanho)', () => {
    const r = montarRanking([l('a', 'Ana', 'sugerir_resposta', 1, 3), l('t', 'Thiago', 'testar_agente', 3, 2), l('a', 'Ana', 'assistente_site', 1, 1)]);
    expect(r.map((x) => [x.nome, x.custo, x.chamadas, x.pct])).toEqual([['Thiago', 3, 2, 60], ['Ana', 2, 4, 40]]);
    expect(r[1]!.partes.map((p) => p.funcionalidade)).toEqual(['assistente_site', 'sugerir_resposta']);
    expect(r[1]!.partes.map((p) => p.pct)).toEqual([50, 50]);
  });
  it('no máximo 10; vazio fica vazio', () => {
    expect(montarRanking(Array.from({ length: 12 }, (_, i) => l(`u${i}`, `P${i}`, 'assistente_site', i + 1)))).toHaveLength(10);
    expect(montarRanking([])).toEqual([]);
  });
});

describe('textoDiaMaisCaro', () => {
  it('com pessoa', () => {
    expect(textoDiaMaisCaro({ dia: '2026-09-26', custo_dia: 3.9, dias_com_gasto: 10, funcionalidade: 'testar_agente', pessoa: 'Thiago', chamadas: 31 }))
      .toBe('26/09 foi o dia mais caro (US$ 3,90): Testar o agente usado 31 vezes por Thiago.');
  });
  it('sem pessoa (agente)', () => {
    expect(textoDiaMaisCaro({ dia: '2026-09-26', custo_dia: 3.9, dias_com_gasto: 2, funcionalidade: 'agente_clientes', pessoa: null, chamadas: 120 }))
      .toBe('26/09 foi o dia mais caro (US$ 3,90): Agente de clientes, 120 chamadas.');
  });
  it('1 chamada: singular ("1 vez", "1 chamada")', () => {
    expect(textoDiaMaisCaro({ dia: '2026-09-26', custo_dia: 3.9, dias_com_gasto: 2, funcionalidade: 'testar_agente', pessoa: 'Thiago', chamadas: 1 }))
      .toBe('26/09 foi o dia mais caro (US$ 3,90): Testar o agente usado 1 vez por Thiago.');
    expect(textoDiaMaisCaro({ dia: '2026-09-26', custo_dia: 3.9, dias_com_gasto: 2, funcionalidade: 'agente_clientes', pessoa: null, chamadas: 1 }))
      .toBe('26/09 foi o dia mais caro (US$ 3,90): Agente de clientes, 1 chamada.');
  });
  it('um dia só ou nada: sem alerta', () => {
    expect(textoDiaMaisCaro({ dia: '2026-09-26', custo_dia: 1, dias_com_gasto: 1, funcionalidade: 'agente_clientes', pessoa: null, chamadas: 1 })).toBeNull();
    expect(textoDiaMaisCaro(null)).toBeNull();
  });
});

describe('formatos', () => {
  it('percentual inteiro, sem dividir por zero', () => {
    expect(percentual(1, 3)).toBe(33);
    expect(percentual(1, 0)).toBe(0);
  });
  const espaco = (s: string | null) => s?.replace(/ /g, ' ') ?? null; // formatos.ts usa espaço que não quebra
  it('US$ fino abaixo de 1 centavo', () => {
    expect(espaco(formatarUsdFino(0.0042))).toBe('US$ 0,0042');
    expect(espaco(formatarUsdFino(0.42))).toBe('US$ 0,42');
  });
  it('R$ só com cotação', () => {
    expect(espaco(emReais(41.2, 5.55))).toBe('R$ 228,66');
    expect(emReais(41.2, null)).toBeNull();
  });
  it('iniciais', () => {
    expect(iniciais('Thiago Brigolini')).toBe('TB');
    expect(iniciais('Ana')).toBe('AN');
  });
});

describe('parâmetros da URL (?pessoa=, ?empresa=)', () => {
  const ID = '0b6f6d7e-3f1a-4c2b-9d8e-1a2b3c4d5e6f';
  it('pessoa: só uuid; o resto é ignorado', () => {
    expect(lerPessoaAberta(ID)).toBe(ID);
    expect(lerPessoaAberta(ID.toUpperCase())).toBe(ID);
    expect(lerPessoaAberta('sem')).toBeNull();
    expect(lerPessoaAberta("1' or 1=1")).toBeNull();
    expect(lerPessoaAberta(undefined)).toBeNull();
  });
  it('empresa: uuid ou "sem" (Sem empresa identificada); o resto é ignorado', () => {
    expect(lerEmpresaAberta(ID)).toBe(ID);
    expect(lerEmpresaAberta('sem')).toBe('sem');
    expect(lerEmpresaAberta('abc')).toBeNull();
    expect(lerEmpresaAberta('')).toBeNull();
    expect(lerEmpresaAberta(undefined)).toBeNull();
  });
});
