import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { criarAlertas } from '../src/alertas';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio } from '../src/envio';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { db, repos } from './apoio/cenario';
import { EmailFalso } from './apoio/email-falso';

let canal: CanalFalso;
let email: EmailFalso;
const alertas = () => criarAlertas({ repos, email, envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  email = new EmailFalso();
  await db.from('configuracoes').update({ email_alertas: 'dono@escritorio.com', telefone_dono: '5531977770000' }).eq('id', 1);
});

describe('criarAlertas', () => {
  it('crítico: painel + e-mail, nunca WhatsApp', async () => {
    await alertas().alertar({ nivel: 'critico', mensagem: 'WhatsApp caiu' });
    expect(email.enviados[0]?.assunto).toContain('URGENTE');
    expect(canal.enviados).toHaveLength(0);
    expect((await db.from('alertas').select('nivel').single()).data).toEqual({ nivel: 'critico' });
  });
  it('operacional: painel + e-mail + WhatsApp do dono', async () => {
    await alertas().alertar({ nivel: 'operacional', mensagem: 'Gasto com IA em 80%' });
    expect(email.enviados).toHaveLength(1);
    expect(canal.enviados).toEqual([{ telefone: '5531977770000', texto: '⚠️ Gasto com IA em 80%' }]);
  });
  it('aviso: só painel', async () => {
    await alertas().alertar({ nivel: 'aviso', mensagem: 'Chamado sem responsável' });
    expect(email.enviados).toHaveLength(0);
    expect(canal.enviados).toHaveLength(0);
  });
});
