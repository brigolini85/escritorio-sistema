import { describe, expect, it } from 'vitest';
import { errosDoFormulario, UsuarioForm } from './esquemas';

const form = (campos: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

describe('UsuarioForm (aba Usuários, pedido do dono, 2026-09-29)', () => {
  it('aceita convite com setores, permissões e as marcações do assistente', () => {
    expect(UsuarioForm.parse(form({ nome: 'Ana', email: 'ANA@escritorio.com', papel: 'atendente', telefone: '(31) 98888-7777',
      setor: 'S1', permissao: ['editar_clientes', 'assistente_site', 'assistente_whatsapp'] })))
      .toEqual({ nome: 'Ana', email: 'ana@escritorio.com', papel: 'atendente', telefone: '5531988887777', setores: ['S1'],
        permissoes: ['editar_clientes', 'assistente_site', 'assistente_whatsapp'] });
  });
  it('assistente pelo WhatsApp exige telefone', () => {
    const r = UsuarioForm.safeParse(form({ nome: 'Ana', email: 'ana@escritorio.com', papel: 'atendente', permissao: 'assistente_whatsapp' }));
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('Informe o telefone para usar o assistente pelo WhatsApp');
  });
  it('telefone preenchido que não é telefone: "Telefone inválido"; vazio fica sem telefone (revisão final, K1)', () => {
    const r = UsuarioForm.safeParse(form({ nome: 'Ana', email: 'ana@escritorio.com', papel: 'atendente', telefone: '12345' }));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(['Telefone inválido']);
    expect(UsuarioForm.parse(form({ nome: 'Ana', email: 'ana@escritorio.com', papel: 'atendente', telefone: '' })).telefone).toBeNull();
    expect(UsuarioForm.parse(form({ nome: 'Ana', email: 'ana@escritorio.com', papel: 'atendente', telefone: '   ' })).telefone).toBeNull();
  });
  it('aceita a permissão Treinar o agente (2026-09-30)', () => {
    expect(UsuarioForm.parse(form({ nome: 'Ana', email: 'ana@escritorio.com', papel: 'atendente', permissao: 'treinar_agente' })).permissoes)
      .toEqual(['treinar_agente']);
  });
  it('recusa permissão desconhecida', () => {
    expect(UsuarioForm.safeParse(form({ nome: 'Ana', email: 'ana@escritorio.com', papel: 'atendente', permissao: 'apagar_tudo' })).success).toBe(false);
  });
});

describe('errosDoFormulario', () => {
  it('cada mensagem vai para o seu campo; o que não é campo vai para geral', () => {
    expect(errosDoFormulario([
      { path: ['telefone'], message: 'Telefone inválido' },
      { path: ['nome'], message: 'Informe o nome' },
      { path: ['permissoes', 0], message: 'Permissão desconhecida' },
    ])).toEqual({ telefone: 'Telefone inválido', nome: 'Informe o nome', geral: 'Permissão desconhecida' });
  });
  it('não repete a mesma mensagem no mesmo campo', () => {
    expect(errosDoFormulario([{ path: ['email'], message: 'E-mail inválido' }, { path: ['email'], message: 'E-mail inválido' }]))
      .toEqual({ email: 'E-mail inválido' });
  });
});
