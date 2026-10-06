import { describe, expect, it } from 'vitest';
import { arquivosRecusados, podeEnviar, textoCusto, textoDestino } from './pedir-agente-tela';

describe('PEDIR AO AGENTE: regras da janela (I4)', () => {
  it('destino escrito antes de enviar (D6)', () => {
    expect(textoDestino({ destino: 'esta_demanda', setor: 'Contábil' }, 1058)).toBe('Nesta demanda #1058');
    expect(textoDestino({ destino: 'nova', setor: 'Contábil' }, 1058)).toBe('Demanda nova no Contábil');
    expect(textoDestino({ destino: 'nova', setor: 'Fiscal' }, null)).toBe('Demanda nova no Fiscal');
  });
  it('custo (D13) e sem I4', () => {
    expect(textoCusto({ custo: { n: 5, min: 0.3, max: 1, limite: 2 } })).toBe('Tarefa de trabalho: costuma custar US$ 0,30–1,00; entra em Gastos com IA.');
    expect(textoCusto({ custo: null })).toBeNull();
  });
  it('só envia com agente, pedido de 3 letras e empresa quando a demanda é nova', () => {
    expect(podeEnviar({ agenteId: 'a', pedido: 'Fechar', temEmpresa: false, destino: 'esta_demanda' })).toBe(true);
    expect(podeEnviar({ agenteId: 'a', pedido: 'Fechar', temEmpresa: false, destino: 'nova' })).toBe(false);
    expect(podeEnviar({ agenteId: '', pedido: 'Fechar', temEmpresa: true, destino: 'nova' })).toBe(false);
    expect(podeEnviar({ agenteId: 'a', pedido: ' ab ', temEmpresa: true, destino: 'nova' })).toBe(false);
  });
  it('arquivos: tipo, tamanho e quantidade (D14 da I3a)', () => {
    expect(arquivosRecusados([{ name: 'a.pdf', size: 10 }, { name: 'b.docx', size: 10 }, { name: 'c.xml', size: 11 * 1024 * 1024 }])).toEqual([
      'b.docx: o agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.', 'c.xml: passa de 10 MB.']);
    expect(arquivosRecusados(Array.from({ length: 31 }, (_, i) => ({ name: `${i}.pdf`, size: 1 })))).toEqual(['No máximo 30 arquivos por tarefa.']);
  });
});
