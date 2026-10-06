// Revisão geral C1: nenhuma mensagem de cliente fica sem resposta e sem pessoa. O batimento acha a mensagem que ninguém
// processou (enfileirar falhou, reentrega duplicada, tentativas esgotadas antes do agente), devolve à fila até 2 vezes e,
// depois, passa a conversa à equipe (demanda na Triagem, "esperando pessoa", aviso ao cliente e alerta).
import { MOTIVOS_PASSAGEM } from '@escritorio/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio } from '../src/envio';
import { FILAS } from '../src/fila';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { processarConversa, type DepsProcessamento } from '../src/processar-conversa';
import { batimento, mensagensParadas, type DepsTarefas } from '../src/tarefas';
import { contatoComEmpresas, db, repos } from './apoio/cenario';
import { EmailFalso } from './apoio/email-falso';
import { FilaFalsa } from './apoio/fila-falsa';
import { IaRoteirizada, fim } from './apoio/ia-roteirizada';

let canal: CanalFalso;
let fila: FilaFalsa;
let alertados: { nivel: string; mensagem: string }[];

function deps(): DepsTarefas {
  return {
    repos, canal, email: new EmailFalso(), fila, relogio: () => new Date(),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    alertas: { alertar: async (a) => { alertados.push(a); } },
  };
}

const minutosAtras = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

async function entradaParada(conversaId: string, idProvedor: string, minutos: number) {
  await repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor, tipo: 'texto', conteudo: 'preciso da guia' });
  await db.from('mensagens').update({ criado_em: minutosAtras(minutos) }).eq('id_provedor', idProvedor);
}

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  fila = new FilaFalsa();
  alertados = [];
});

describe('mensagem de cliente parada (batimento)', () => {
  it('o batimento devolve à fila a conversa com mensagem parada há mais de 3 minutos', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entradaParada(conversa.id, 'P1', 10);
    await batimento(deps());
    expect(fila.enviados.filter((e) => e.nome === FILAS.processarConversa)).toEqual([
      { nome: FILAS.processarConversa, dados: { conversaId: conversa.id }, opcoes: { singletonKey: conversa.id, startAfter: 8 } }]);
    const { data } = await db.from('mensagens').select('reenfileirada').eq('id_provedor', 'P1').single();
    expect(data!.reenfileirada).toBe(1);
  });

  it('não devolve de novo antes de 3 minutos; devolve no máximo 2 vezes', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entradaParada(conversa.id, 'P1', 30);
    expect(await mensagensParadas(deps())).toEqual({ devolvidas: 1, aEquipe: 0 });
    expect(await mensagensParadas(deps())).toEqual({ devolvidas: 0, aEquipe: 0 });
    await db.from('mensagens').update({ reenfileirada_em: minutosAtras(4) }).eq('id_provedor', 'P1');
    expect(await mensagensParadas(deps())).toEqual({ devolvidas: 1, aEquipe: 0 });
    // Duas devoluções: só passa à equipe 5 minutos depois da última.
    expect(await mensagensParadas(deps())).toEqual({ devolvidas: 0, aEquipe: 0 });
    expect(canal.enviados).toHaveLength(0);
  });

  it('depois de 2 devoluções sem sucesso: Triagem, esperando pessoa, aviso ao cliente uma vez, alerta e mensagem marcada', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entradaParada(conversa.id, 'P1', 30);
    await db.from('mensagens').update({ reenfileirada: 2, reenfileirada_em: minutosAtras(6) }).eq('id_provedor', 'P1');
    expect(await mensagensParadas(deps())).toEqual({ devolvidas: 0, aEquipe: 1 });
    const chamados = await repos.chamadosAbertosDaConversa(conversa.id);
    expect(chamados).toHaveLength(1);
    expect(chamados[0]!.setor_id).toBeNull();
    const c = await repos.obterConversa(conversa.id);
    expect(c.aguardando_pessoa_desde).not.toBeNull();
    expect(c.motivo_pessoa).toBe(MOTIVOS_PASSAGEM.semResposta);
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Recebemos sua mensagem, já vamos te atender.']);
    expect(alertados).toHaveLength(1);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(0);
    expect(fila.enviados).toHaveLength(0);
    // Nada mais a fazer na próxima volta.
    expect(await mensagensParadas(deps())).toEqual({ devolvidas: 0, aEquipe: 0 });
  });

  it('conversa com a equipe e mensagem de mais de 24 h ficam de fora', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entradaParada(conversa.id, 'P1', 25 * 60);
    const outra = await repos.obterOuCriarConversa('5531999990002', null);
    await entradaParada(outra.id, 'P2', 10);
    await db.from('conversas').update({ estado: 'humano' }).eq('id', outra.id);
    expect(await mensagensParadas(deps())).toEqual({ devolvidas: 0, aEquipe: 0 });
  });

  it('falha numa conversa não impede o resto do batimento (sinal de vida)', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entradaParada(conversa.id, 'P1', 10);
    const d = deps();
    d.repos = { ...repos, conversasComMensagemParada: async () => { throw new Error('banco fora'); } };
    await batimento(d);
    expect(Object.keys(await repos.sinaisVida())).toContain('fila');
  });
});

describe('processarConversa: falha antes do agente na última tentativa', () => {
  function depsProc(extra: Partial<DepsProcessamento> = {}): DepsProcessamento {
    return {
      repos, ia: new IaRoteirizada([fim()]), fila: new FilaFalsa(),
      envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
      midia: criarArmazenamento(db, vi.fn()),
      transcritor: { modelo: 'x', provedor: 'groq', transcrever: vi.fn() },
      alertas: { alertar: async (a) => { alertados.push(a); } },
      relogio: () => new Date('2026-09-28T13:00:00Z'),
      ...extra,
    };
  }
  const reposQuebrado = { ...repos, obterConfiguracoes: vi.fn() };

  it('antes da última: relança (a fila tenta de novo)', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entradaParada(conversa.id, 'P1', 0);
    reposQuebrado.obterConfiguracoes.mockRejectedValue(new Error('banco instável'));
    await expect(processarConversa(depsProc({ repos: reposQuebrado as never }), conversa.id, false)).rejects.toThrow('banco instável');
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(1);
  });

  it('na última: passa à equipe (Triagem, esperando pessoa) e marca a mensagem, sem chamar a IA', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entradaParada(conversa.id, 'P1', 0);
    // Falha só na primeira leitura (a do atendimento); a passagem à equipe lê de novo e consegue.
    const obterConfiguracoes = vi.fn().mockRejectedValueOnce(new Error('banco instável')).mockImplementation(() => repos.obterConfiguracoes());
    const ia = new IaRoteirizada([fim()]);
    expect(await processarConversa(depsProc({ ia, repos: { ...repos, obterConfiguracoes } }), conversa.id, true)).toBe('escalado');
    expect(ia.recebidos).toHaveLength(0);
    expect((await repos.chamadosAbertosDaConversa(conversa.id))[0]?.setor_id).toBeNull();
    expect((await repos.obterConversa(conversa.id)).motivo_pessoa).toBe(MOTIVOS_PASSAGEM.falha);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(0);
  });
});
