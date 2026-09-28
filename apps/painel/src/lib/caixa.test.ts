import { describe, expect, it } from 'vitest';
import { filtroPadrao, passaNoFiltro, type LinhaCaixa } from './caixa';

const u = { id: 'ana', setores: ['fiscal'] };
const linha = (p: Partial<LinhaCaixa>): LinhaCaixa => ({ id: 'c', atendente_id: null, setores_abertos: [], sem_responsavel: false, aguardando_cliente: false, ...p });

describe('passaNoFiltro', () => {
  it('minhas = conversas que eu assumi', () => {
    expect(passaNoFiltro(linha({ atendente_id: 'ana' }), 'minhas', u)).toBe(true);
    expect(passaNoFiltro(linha({ atendente_id: 'caio' }), 'minhas', u)).toBe(false);
  });
  it('setor = chamado aberto em um dos meus setores', () => {
    expect(passaNoFiltro(linha({ setores_abertos: ['fiscal'] }), 'setor', u)).toBe(true);
    expect(passaNoFiltro(linha({ setores_abertos: ['pessoal'] }), 'setor', u)).toBe(false);
  });
  it('sem responsável e aguardando cliente', () => {
    expect(passaNoFiltro(linha({ sem_responsavel: true }), 'sem_responsavel', u)).toBe(true);
    expect(passaNoFiltro(linha({ aguardando_cliente: true }), 'aguardando', u)).toBe(true);
  });
  it('todas mostra tudo o que o RLS já liberou', () => {
    expect(passaNoFiltro(linha({}), 'todas', u)).toBe(true);
  });
});

describe('filtroPadrao', () => {
  it('administrador e quem não tem setor começam em Todas', () => {
    expect(filtroPadrao({ papel: 'admin', setores: ['fiscal'] })).toBe('todas');
    expect(filtroPadrao({ papel: 'atendente', setores: [] })).toBe('todas');
  });
  it('atendente com setor começa em Do meu setor', () => {
    expect(filtroPadrao({ papel: 'atendente', setores: ['fiscal'] })).toBe('setor');
  });
});
