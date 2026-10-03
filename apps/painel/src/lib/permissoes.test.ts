import { MODULOS, NIVEIS, NIVEIS_PADRAO } from '@escritorio/core';
import { describe, expect, it } from 'vitest';
import { AJUDA_MODULO, ROTULO_MODULO, ROTULO_NIVEL, temNivel, usaAssistente } from './permissoes';

describe('permissões no painel (Parte D)', () => {
  it('todo módulo e todo nível têm rótulo e ajuda', () => {
    for (const m of MODULOS) {
      expect(ROTULO_MODULO[m]).toBeTruthy();
      expect(AJUDA_MODULO[m]).toBeTruthy();
      for (const n of NIVEIS[m]) expect((ROTULO_NIVEL[m] as Record<string, string>)[n]).toBeTruthy();
    }
  });

  it('administrador passa em tudo, menos no assistente (é por marcação)', () => {
    const admin = { papel: 'admin' as const, niveis: NIVEIS_PADRAO };
    expect(temNivel(admin, 'clientes', 'arquivar')).toBe(true);
    expect(usaAssistente(admin)).toBe(false);
    const ana = { papel: 'atendente' as const, niveis: { ...NIVEIS_PADRAO, clientes: 'editar' as const, assistente: 'site' as const } };
    expect(temNivel(ana, 'clientes', 'editar')).toBe(true);
    expect(temNivel(ana, 'clientes', 'arquivar')).toBe(false);
    expect(usaAssistente(ana)).toBe(true);
    expect(usaAssistente(ana, 'whatsapp')).toBe(false);
  });
});
