import { describe, expect, it } from 'vitest';
import { lerConfig } from '../src/config';

const completo = {
  SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'k', DATABASE_URL: 'postgresql://x',
  ANTHROPIC_API_KEY: 'k', ZAPI_INSTANCIA: 'i', ZAPI_TOKEN: 't', ZAPI_CLIENT_TOKEN: 'c',
  WEBHOOK_SEGREDO: 'segredo-com-16-caracteres', TRANSCRICAO_BASE_URL: 'https://api.groq.com/openai/v1',
  TRANSCRICAO_API_KEY: 'k', TRANSCRICAO_MODELO: 'whisper-large-v3', SMTP_HOST: 'smtp', SMTP_USUARIO: 'u',
  SMTP_SENHA: 's', SMTP_REMETENTE: 'avisos@escritorio.com.br', AMBIENTE: 'local',
};

describe('lerConfig', () => {
  it('aceita a configuração completa, com padrões e vocabulário opcional', () => {
    const c = lerConfig(completo);
    expect(c.PORTA).toBe(3001);
    expect(c.TRANSCRICAO_VOCABULARIO).toBeUndefined();
    expect(lerConfig({ ...completo, TRANSCRICAO_VOCABULARIO: 'DAS, INSS' }).TRANSCRICAO_VOCABULARIO).toBe('DAS, INSS');
  });
  it('vocabulário vazio no .env conta como não informado', () => {
    expect(lerConfig({ ...completo, TRANSCRICAO_VOCABULARIO: '' }).TRANSCRICAO_VOCABULARIO).toBeUndefined();
  });
  it('lista em português o que está faltando', () => {
    expect(() => lerConfig({})).toThrow(/Configuração inválida ou faltando: .*SUPABASE_URL/);
  });
  it('lista o que falta', () => {
    const { ZAPI_TOKEN: _, ...semToken } = completo;
    expect(() => lerConfig(semToken)).toThrow('Configuração inválida ou faltando: ZAPI_TOKEN');
  });
});
