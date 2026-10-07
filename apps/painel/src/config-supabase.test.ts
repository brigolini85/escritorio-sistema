import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// O Auth local (supabase/config.toml) segue as mesmas regras do painel. Na nuvem os mesmos valores são ajustados no
// painel do Supabase (ver ARQUITETURA-SEGURANCA/01-login-e-sessao-CORRECOES.md).
const toml = readFileSync(new URL('../../../supabase/config.toml', import.meta.url), 'utf8');

/** Valor de `chave = valor` dentro de `[secao]` (só o necessário para estes testes, sem biblioteca de TOML). */
function valor(secao: string, chave: string): string | undefined {
  const linhas = toml.split(/\r?\n/);
  let dentro = false;
  for (const l of linhas) {
    const t = l.trim();
    if (t.startsWith('[')) dentro = t === `[${secao}]`;
    else if (dentro) {
      const m = /^([a-z_]+)\s*=\s*(.+)$/.exec(t);
      if (m && m[1] === chave) return m[2]!.replace(/^"|"$/g, '');
    }
  }
  return undefined;
}

describe('supabase/config.toml: Auth', () => {
  it('senha mínima de 10 caracteres, igual ao painel (item 3)', () => {
    expect(valor('auth', 'minimum_password_length')).toBe('10');
  });
  it('cadastro aberto e login anônimo seguem desligados', () => {
    expect(valor('auth', 'enable_signup')).toBe('false');
    expect(valor('auth', 'enable_anonymous_sign_ins')).toBe('false');
  });
});
