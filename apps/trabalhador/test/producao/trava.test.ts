import { describe, expect, it } from 'vitest';
import { CanalFalso } from '../../src/canal/falso';
import { canalComTrava, envioPermitido, type RegraEnvio } from '../../src/canal/trava';
import { lerConfig } from '../../src/config';

const HOMOLOG: RegraEnvio = { ambiente: 'homologacao', permitidos: ['5531988887777'] };

const base = {
  SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'k', DATABASE_URL: 'postgresql://x',
  ANTHROPIC_API_KEY: 'k', ZAPI_INSTANCIA: 'i', ZAPI_TOKEN: 't', ZAPI_CLIENT_TOKEN: 'c',
  WEBHOOK_SEGREDO: 'segredo-com-16-caracteres', TRANSCRICAO_BASE_URL: 'https://api.groq.com/openai/v1',
  TRANSCRICAO_API_KEY: 'k', TRANSCRICAO_MODELO: 'whisper-large-v3', SMTP_HOST: 'smtp', SMTP_USUARIO: 'u',
  SMTP_SENHA: 's', SMTP_REMETENTE: 'avisos@escritorio.com.br',
};

describe('envioPermitido (D2)', () => {
  it('produção: tudo passa', () => {
    expect(envioPermitido({ ambiente: 'producao', permitidos: [] }, '5531911112222')).toBe(true);
  });
  it('fora da produção: só a lista, com ou sem o 9 e o 55', () => {
    expect(envioPermitido(HOMOLOG, '5531988887777')).toBe(true);
    expect(envioPermitido(HOMOLOG, '553188887777')).toBe(true);
    expect(envioPermitido(HOMOLOG, '31988887777')).toBe(true);
    expect(envioPermitido(HOMOLOG, '5531911112222')).toBe(false);
    expect(envioPermitido(HOMOLOG, 'lixo')).toBe(false);
    expect(envioPermitido({ ambiente: 'local', permitidos: [] }, '5531988887777')).toBe(false);
  });
});

describe('canalComTrava (D1)', () => {
  it('bloqueia texto e arquivo fora da lista, registra mascarado e devolve um id de bloqueio', async () => {
    const real = new CanalFalso();
    const bloqueios: { telefoneFinal: string; tipo: string }[] = [];
    const canal = canalComTrava(real, HOMOLOG, async (b) => { bloqueios.push(b); });
    const t = await canal.enviarTexto('5531911112222', 'oi');
    const a = await canal.enviarArquivo('5531911112222', { url: 'data:application/pdf;base64,AA==', nome: 'x.pdf' });
    expect(t.idProvedor).toMatch(/^bloqueado-/);
    expect(a.idProvedor).toMatch(/^bloqueado-/);
    expect(real.enviados).toHaveLength(0);
    expect(bloqueios).toEqual([{ telefoneFinal: '…2222', tipo: 'texto' }, { telefoneFinal: '…2222', tipo: 'arquivo' }]);
  });
  it('deixa passar quem está na lista e o resto do canal (status, webhook) fica igual', async () => {
    const real = new CanalFalso();
    const canal = canalComTrava(real, HOMOLOG, async () => {});
    await canal.enviarTexto('5531988887777', 'oi');
    expect(real.enviados).toHaveLength(1);
    expect(await canal.status()).toEqual(await real.status());
    expect(canal.interpretarWebhook({})).toEqual(real.interpretarWebhook({}));
  });
  it('produção: tudo passa, nada é registrado', async () => {
    const real = new CanalFalso();
    let registros = 0;
    const canal = canalComTrava(real, { ambiente: 'producao', permitidos: [] }, async () => { registros++; });
    await canal.enviarTexto('5531911112222', 'oi');
    expect(real.enviados).toHaveLength(1);
    expect(registros).toBe(0);
  });
  it('falha ao registrar o bloqueio não derruba o fluxo', async () => {
    const canal = canalComTrava(new CanalFalso(), HOMOLOG, async () => { throw new Error('banco'); });
    await expect(canal.enviarTexto('5531911112222', 'oi')).resolves.toMatchObject({ idProvedor: expect.stringMatching(/^bloqueado-/) });
  });
});

describe('config (D2)', () => {
  it('sem AMBIENTE o trabalhador não sobe e a mensagem diz o que pôr', () => {
    expect(() => lerConfig({ ...base })).toThrow(/AMBIENTE/);
    expect(() => lerConfig({ ...base })).toThrow(/producao, homologacao ou local/);
  });
  it('a lista vem normalizada', () => {
    const c = lerConfig({ ...base, AMBIENTE: 'homologacao', TELEFONES_PERMITIDOS: ' 31 98888-7777 , 5531977776666 ,, ' });
    expect(c.AMBIENTE).toBe('homologacao');
    expect(c.TELEFONES_PERMITIDOS).toEqual(['5531988887777', '5531977776666']);
    expect(lerConfig({ ...base, AMBIENTE: 'producao' }).TELEFONES_PERMITIDOS).toEqual([]);
  });
  it('AMBIENTE desconhecido é recusado', () => {
    expect(() => lerConfig({ ...base, AMBIENTE: 'prod' })).toThrow(/AMBIENTE/);
  });
});
