import ExcelJS from 'exceljs';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { ResultadoTarefa } from '@escritorio/core';
import { planilhaDaTarefa } from './planilha-tarefa';

const R: ResultadoTarefa = {
  versao: 1, resumo: 'Prévia de outubro', observacoes: 'Sem extrato do BB.',
  destaques: [{ rotulo: 'Saídas', valor: 'R$ 1.980,55', detalhe: null }],
  linhas: [
    { descricao: 'DAS Simples Nacional', valor: -1980.55, texto: null, fonte: 'extrato.csv', provisoria: false },
    { descricao: '=SOMA(A1:A9)', valor: null, texto: '@x', fonte: 'pendência 1', provisoria: true },
  ],
};
const P = [{ id: 'p', numero: 1, tipo: 'cliente' as const, pergunta: 'Extrato do BB', estado: 'aberta' as const, resposta: null }] as never;

describe('planilhaDaTarefa (D10)', () => {
  it('é um XLSX que um leitor de terceiros abre, com número como número e texto como texto', async () => {
    const bytes = planilhaDaTarefa({ resultado: R, pendencias: P })!;
    expect(Object.keys(unzipSync(bytes))).toContain('xl/worksheets/sheet1.xml');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Resultado', 'Destaques', 'Pendências']);
    const res = wb.getWorksheet('Resultado')!;
    expect(res.getCell('A1').text).toBe('Descrição');
    expect(res.getCell('B2').value).toBe(-1980.55);
    expect(res.getCell('B2').numFmt).toBe('#,##0.00');
    expect(res.getCell('A3').text).toBe('=SOMA(A1:A9)');
    expect(res.getCell('A3').formula).toBeUndefined();
    expect(res.getCell('E3').text).toBe('sim');
    expect(wb.getWorksheet('Pendências')!.getCell('C2').text).toBe('Extrato do BB');
  });
  it('mesmo resultado, mesmos bytes; sem resultado, nada', () => {
    expect(planilhaDaTarefa({ resultado: R, pendencias: P })).toEqual(planilhaDaTarefa({ resultado: R, pendencias: P }));
    expect(planilhaDaTarefa({ resultado: null, pendencias: [] })).toBeNull();
  });
  it('célula de texto acima de 32767 caracteres é cortada com reticências (o Excel pediria reparo)', async () => {
    const longo: ResultadoTarefa = { ...R, linhas: [{ descricao: 'x'.repeat(40000), valor: null, texto: null, fonte: 'a', provisoria: false }] };
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(planilhaDaTarefa({ resultado: longo, pendencias: [] })!) as never);
    const t = wb.getWorksheet('Resultado')!.getCell('A2').text;
    expect(t.length).toBe(32767);
    expect(t.endsWith('…')).toBe(true);
  });
});
