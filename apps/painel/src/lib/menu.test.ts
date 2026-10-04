import { NIVEIS_PADRAO, type Niveis } from '@escritorio/core';
import { describe, expect, it } from 'vitest';
import { itensDoMenu } from './menu';

const n = (x: Partial<Niveis> = {}): Niveis => ({ ...NIVEIS_PADRAO, ...x });
const rotulos = (papel: 'admin' | 'atendente', niveis: Niveis) => itensDoMenu({ papel, niveis }).map((i) => i.rotulo);

describe('menu pelos níveis (Parte D)', () => {
  it('atendente com os níveis de sempre: o menu de antes', () => {
    expect(rotulos('atendente', n())).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos']);
  });
  it('assistente e treinar aparecem pelo nível', () => {
    expect(rotulos('atendente', n({ assistente: 'site' }))).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Assistente']);
    expect(rotulos('atendente', n({ treinar: 'sim', assistente: 'site_whatsapp' })))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Assistente', 'Treinar o agente']);
  });
  it('Atendimento some com "Sem acesso"', () => {
    expect(rotulos('atendente', n({ atendimento: 'sem_acesso' }))).toEqual(['Início', 'Demandas', 'Clientes', 'Contatos']);
  });
  it('Configurações para quem tem "Sim", sem Usuários e permissões', () => {
    const conf = itensDoMenu({ papel: 'atendente', niveis: n({ configuracoes: 'sim' }) }).find((i) => i.rotulo === 'Configurações')!;
    expect(conf.filhos!.map((f) => f.rotulo)).not.toContain('Usuários e permissões');
    // Sem o teto de IA, o item não promete "IA".
    expect(conf.filhos!.map((f) => f.rotulo)).toContain('Expediente');
    expect(conf.filhos!.map((f) => f.rotulo)).not.toContain('Expediente e IA');
    expect(conf.filhos!.find((f) => f.rotulo === 'Setores')?.href).toBe('/configuracoes?secao=setores');
    expect(conf.filhos!.map((f) => f.rotulo)).not.toContain('Teto e modelos de IA');
  });
  it('Gastos com IA: só o administrador, antes de Configurações (spec 7)', () => {
    expect(rotulos('admin', n())).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Treinar o agente', 'Gastos com IA', 'Configurações']);
    expect(rotulos('atendente', n({ configuracoes: 'sim', treinar: 'sim', assistente: 'site_whatsapp' }))).not.toContain('Gastos com IA');
  });
  it('administrador: Treinar e Configurações completas; Assistente só com a marcação', () => {
    const itens = itensDoMenu({ papel: 'admin', niveis: n() });
    expect(itens.map((i) => i.rotulo)).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Treinar o agente', 'Gastos com IA', 'Configurações']);
    expect(itens.at(-1)!.filhos!.map((f) => f.rotulo)).toContain('Usuários e permissões');
    const adminConf = itens.find((i) => i.rotulo === 'Configurações')!;
    expect(adminConf.filhos!.map((f) => f.rotulo)).toContain('Teto e modelos de IA');
    expect(rotulos('admin', n({ assistente: 'site' }))).toContain('Assistente');
  });
});
