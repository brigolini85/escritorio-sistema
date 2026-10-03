import { describe, expect, it } from 'vitest';
import { exigirBancoLocal } from '../e2e/trava-local';

// A trava dos testes e2e (revisão final da Parte C, C1): cliente de serviço só contra o Supabase local.
describe('exigirBancoLocal', () => {
  it('aceita 127.0.0.1 e localhost, em qualquer porta', () => {
    expect(() => exigirBancoLocal('http://127.0.0.1:56321', 'SUPABASE_URL')).not.toThrow();
    expect(() => exigirBancoLocal('http://localhost:54321', 'SUPABASE_URL')).not.toThrow();
    expect(() => exigirBancoLocal('postgresql://postgres:postgres@127.0.0.1:56322/postgres', 'DATABASE_URL')).not.toThrow();
  });
  it('recusa um endereço de fora (homologação, produção), com mensagem clara', () => {
    expect(() => exigirBancoLocal('https://abcdefgh.supabase.co', 'SUPABASE_URL')).toThrow(/SUPABASE_URL.*abcdefgh\.supabase\.co.*local/s);
    expect(() => exigirBancoLocal('postgresql://u:p@db.abcdefgh.supabase.co:5432/postgres', 'DATABASE_URL')).toThrow(/DATABASE_URL/);
    // Truque de nome: o host é o que vale, não o texto da URL.
    expect(() => exigirBancoLocal('https://127.0.0.1.exemplo.com', 'SUPABASE_URL')).toThrow();
    expect(() => exigirBancoLocal('https://exemplo.com/?x=localhost', 'SUPABASE_URL')).toThrow();
  });
  it('recusa endereço vazio ou inválido', () => {
    expect(() => exigirBancoLocal(undefined, 'SUPABASE_URL')).toThrow(/SUPABASE_URL/);
    expect(() => exigirBancoLocal('', 'SUPABASE_URL')).toThrow();
    expect(() => exigirBancoLocal('não é url', 'SUPABASE_URL')).toThrow();
  });
});
