import { describe, expect, it } from 'vitest';
import { cookieDaEscolha, dataThemeDoCookie, escolhaDoCookie } from './tema';

describe('tema pelo cookie', () => {
  it('claro e escuro viram data-theme; ausente ou desconhecido segue o sistema', () => {
    expect(dataThemeDoCookie('claro')).toBe('light');
    expect(dataThemeDoCookie('escuro')).toBe('dark');
    expect(dataThemeDoCookie(undefined)).toBeUndefined();
    expect(dataThemeDoCookie(null)).toBeUndefined();
    expect(dataThemeDoCookie('')).toBeUndefined();
    expect(dataThemeDoCookie('dark')).toBeUndefined();
  });

  it('escolha mostrada no alternador', () => {
    expect(escolhaDoCookie('claro')).toBe('claro');
    expect(escolhaDoCookie('escuro')).toBe('escuro');
    expect(escolhaDoCookie(undefined)).toBe('sistema');
    expect(escolhaDoCookie('qualquer')).toBe('sistema');
  });

  it('gravar claro/escuro guarda por um ano; sistema apaga o cookie', () => {
    expect(cookieDaEscolha('escuro')).toBe('tema=escuro; Path=/; Max-Age=31536000; SameSite=Lax');
    expect(cookieDaEscolha('claro')).toBe('tema=claro; Path=/; Max-Age=31536000; SameSite=Lax');
    expect(cookieDaEscolha('sistema')).toBe('tema=; Path=/; Max-Age=0; SameSite=Lax');
  });
});
