// Revisão geral I4: cliente com resposta automática e o agente respondendo um ao outro sem fim (custo de IA, Z-API e risco
// de banimento do número). Muitas mensagens do agente na conversa em pouco tempo: para e passa à equipe.
import { MOTIVOS_PASSAGEM } from '@escritorio/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio } from '../src/envio';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { LIMITE_VOLUME, processarConversa, type DepsProcessamento } from '../src/processar-conversa';
import { contatoComEmpresas, db, repos } from './apoio/cenario';
import { FilaFalsa } from './apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from './apoio/ia-roteirizada';

let canal: CanalFalso;
let alertados: { nivel: string; mensagem: string }[];

function deps(ia: IaRoteirizada): DepsProcessamento {
  return {
    repos, ia, fila: new FilaFalsa(),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db, vi.fn()),
    transcritor: { modelo: 'x', provedor: 'groq', transcrever: vi.fn() },
    alertas: { alertar: async (a) => { alertados.push(a); } },
    relogio: () => new Date('2026-09-28T13:00:00Z'),
  };
}

async function saidasDoAgente(conversaId: string, n: number, minutosAtras: number) {
  const criado = new Date(Date.now() - minutosAtras * 60_000).toISOString();
  const linhas = Array.from({ length: n }, (_, i) => ({ conversa_id: conversaId, direcao: 'saida' as const, autor: 'agente' as const, tipo: 'texto' as const,
    conteudo: `Resposta ${i}`, status_envio: 'enviada' as const, id_provedor: `V-${minutosAtras}-${i}`, criado_em: criado, processada_em: criado }));
  const { error } = await db.from('mensagens').insert(linhas);
  if (error) throw error;
}

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  alertados = [];
});

describe('trava de volume por conversa', () => {
  it(`com o limite de mensagens do agente em ${LIMITE_VOLUME.minutos} min: não chama a IA, passa à equipe e avisa`, async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await db.from('conversas').update({ aviso_lgpd_enviado_em: new Date().toISOString() }).eq('id', conversa.id);
    await saidasDoAgente(conversa.id, LIMITE_VOLUME.saidas, 5);
    await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: 'AUTO-1', tipo: 'texto', conteudo: 'Olá! Recebemos sua mensagem.' });
    const ia = new IaRoteirizada([fim()]);
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('volume');
    expect(ia.recebidos).toHaveLength(0);
    expect(canal.enviados).toHaveLength(0);
    const c = await repos.obterConversa(conversa.id);
    expect(c.motivo_pessoa).toBe(MOTIVOS_PASSAGEM.volume);
    expect((await repos.chamadosAbertosDaConversa(conversa.id))).toHaveLength(1);
    expect(alertados).toHaveLength(1);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(0);
  });

  it('abaixo do limite, ou com as mensagens antigas, atende normalmente', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await db.from('conversas').update({ aviso_lgpd_enviado_em: new Date().toISOString() }).eq('id', conversa.id);
    await saidasDoAgente(conversa.id, LIMITE_VOLUME.saidas - 1, 5);
    await saidasDoAgente(conversa.id, 10, LIMITE_VOLUME.minutos + 5);
    await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: 'C-1', tipo: 'texto', conteudo: 'oi' });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('agente');
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Olá!']);
  });
});
