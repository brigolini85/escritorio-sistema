// Revisão geral I7: mensagem de número fora do formato brasileiro (estrangeiro, ou identificador "@lid") sumia sem rastro.
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { criarServidor } from '../src/servidor';
import { db, repos } from './apoio/cenario';
import { FilaFalsa } from './apoio/fila-falsa';
import * as f from './fixtures/zapi/sinteticos';

const URL_OK = '/webhook/zapi/segredo-com-16-caracteres';
let fila: FilaFalsa;
const servidor = () => criarServidor({ canal: new CanalFalso(), repos, fila, segredo: 'segredo-com-16-caracteres', relogio: () => new Date() });
const alertas = async () => (await db.from('alertas').select('nivel, mensagem')).data!;

beforeEach(async () => {
  await limparBanco();
  fila = new FilaFalsa();
});

describe('número fora do formato brasileiro', () => {
  it('não vira conversa, mas gera um alerta para a equipe com o número (uma vez por hora por número)', async () => {
    const app = servidor();
    const r = await app.inject({ method: 'POST', url: URL_OK, payload: { ...f.texto, phone: '14155550123' } });
    expect(r.statusCode).toBe(200);
    await app.inject({ method: 'POST', url: URL_OK, payload: { ...f.texto, messageId: 'MSG-2', phone: '14155550123' } });
    expect(fila.enviados).toHaveLength(0);
    const a = await alertas();
    expect(a).toHaveLength(1);
    expect(a[0]!.nivel).toBe('aviso');
    expect(a[0]!.mensagem).toContain('14155550123');
  });

  it('identificador @lid também gera o alerta', async () => {
    await servidor().inject({ method: 'POST', url: URL_OK, payload: { ...f.texto, phone: '123456789012345@lid' } });
    expect((await alertas())[0]!.mensagem).toContain('123456789012345@lid');
  });
});
