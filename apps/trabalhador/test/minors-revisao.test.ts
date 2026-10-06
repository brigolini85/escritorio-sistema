// Revisão geral, Minors baratos: M1 (resumo diário repetido quando o e-mail falha) e M5 (reação disparava o agente).
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio } from '../src/envio';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { resumoDiario, type DepsTarefas } from '../src/tarefas';
import { db, repos } from './apoio/cenario';
import { FilaFalsa } from './apoio/fila-falsa';
import * as f from './fixtures/zapi/sinteticos';

describe('M1: resumo diário com o e-mail fora', () => {
  beforeEach(async () => { await limparBanco(); });
  it('não lança (a fila não repete o WhatsApp ao dono); o WhatsApp sai uma vez', async () => {
    await db.from('configuracoes').update({ email_alertas: 'dono@escritorio.com', telefone_dono: '5531977770000' }).eq('id', 1);
    const canal = new CanalFalso();
    const d: DepsTarefas = {
      repos, canal, fila: new FilaFalsa(), relogio: () => new Date(), alertas: { alertar: async () => {} },
      envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
      email: { enviar: async () => { throw new Error('SMTP fora'); } },
    };
    await expect(resumoDiario(d)).resolves.toBeUndefined();
    expect(canal.enviados).toHaveLength(1);
  });
});

describe('M5: reação a uma mensagem', () => {
  it('não vira mensagem do cliente (nem chama o agente)', () => {
    const canal = new CanalFalso();
    const { text: _t, ...semTexto } = f.texto as Record<string, unknown>;
    expect(canal.interpretarWebhook({ ...semTexto, messageId: 'R1', reaction: { value: '👍', referencedMessage: { messageId: 'X' } } })).toBeNull();
  });
});
