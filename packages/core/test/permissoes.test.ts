import { describe, expect, it } from 'vitest';
import { lerNiveis, MODULOS, NIVEIS, NIVEIS_PADRAO, nivelAtinge } from '../src/permissoes';

describe('permissões por nível (Parte D)', () => {
  it('nove módulos, cada um com o padrão entre os seus níveis', () => {
    expect(MODULOS).toEqual(['atendimento', 'demandas', 'clientes', 'precos', 'notas', 'assistente', 'treinar', 'prazos', 'configuracoes']);
    for (const m of MODULOS) expect(NIVEIS[m]).toContain(NIVEIS_PADRAO[m]);
  });

  it('quem tem um nível tem os de antes dele', () => {
    expect(nivelAtinge('demandas', 'todas', 'meu_setor')).toBe(true);
    expect(nivelAtinge('demandas', 'minhas', 'meu_setor')).toBe(false);
    expect(nivelAtinge('clientes', 'arquivar', 'editar')).toBe(true);
    expect(nivelAtinge('assistente', 'site', 'site_whatsapp')).toBe(false);
    expect(nivelAtinge('notas', 'ver', 'ver')).toBe(true);
  });

  it('lerNiveis completa com o padrão e ignora módulo ou nível desconhecido', () => {
    expect(lerNiveis({ demandas: 'todas', clientes: 'tudo', outro: 'x' })).toEqual({ ...NIVEIS_PADRAO, demandas: 'todas' });
    expect(lerNiveis(null)).toEqual(NIVEIS_PADRAO);
  });
});
