import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Config } from '../../src/config';

// Prontidão mínima: os exemplos por app do Easypanel não podem esquecer variável nem dar ao painel chave do trabalhador.
const ler = (nome: string) => readFileSync(new URL(`../../../../deploy/${nome}`, import.meta.url), 'utf8');
const nomes = (texto: string) =>
  texto.split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => l.slice(0, l.indexOf('=')));
const valor = (texto: string, nome: string) => texto.split(/\r?\n/).find((l) => l.startsWith(`${nome}=`))?.slice(nome.length + 1);

describe('deploy/*.env.example', () => {
  it('trabalhador: todas as variáveis da configuração, AMBIENTE=producao e nenhum valor secreto preenchido', () => {
    const t = ler('trabalhador.env.example');
    expect(nomes(t).sort()).toEqual(Object.keys(Config.shape).sort());
    expect(valor(t, 'AMBIENTE')).toBe('producao');
    for (const n of nomes(t)) if (!['AMBIENTE', 'SMTP_PORTA', 'PORTA'].includes(n)) expect(valor(t, n), n).toBe('');
  });
  it('painel: AMBIENTE=producao e nenhuma chave que só o trabalhador usa', () => {
    const p = ler('painel.env.example');
    expect(valor(p, 'AMBIENTE')).toBe('producao');
    const doTrabalhador = /^(ANTHROPIC_|ZAPI_|WEBHOOK_SEGREDO|TRANSCRICAO_|SMTP_|GOOGLE_DRIVE_|TELEFONES_PERMITIDOS|SAUDE_TOKEN|SUPABASE_URL$)/;
    expect(nomes(p).filter((n) => doTrabalhador.test(n))).toEqual([]);
    expect(nomes(p)).toEqual(expect.arrayContaining(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA',
      'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'PAINEL_URL', 'ACESSOS_PORTAIS_CHAVE']));
    for (const n of nomes(p)) if (n !== 'AMBIENTE') expect(valor(p, n), n).toBe('');
  });
});
