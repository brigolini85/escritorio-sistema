// Auditoria 4.1, 4.4, 4.6, 4.10 e 4.17: implantação ou queda no meio de uma vez não repete resposta nem demanda; a trava é
// renovada enquanto a vez roda e solta no desligamento; o batimento e a limpeza respeitam a vez.
import { MOTIVOS_PASSAGEM } from '@escritorio/core';
import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import type { ParametrosIa } from '../src/agente/cliente-ia';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio } from '../src/envio';
import { FILAS, encerrarComCalma, naVez } from '../src/fila';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { PRAZO_VEZ_CONVERSA_MS, processarConversa, type DepsProcessamento } from '../src/processar-conversa';
import { limpezaNaVez } from '../src/retencao';
import { PARADA, mensagensParadas, type DepsTarefas } from '../src/tarefas';
import { contatoComEmpresas, db, repos, setorId } from './apoio/cenario';
import { EmailFalso } from './apoio/email-falso';
import { FilaFalsa } from './apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from './apoio/ia-roteirizada';

let canal: CanalFalso;
const AVISO_IA = 'Recebemos sua mensagem, já vamos te atender.';

function deps(ia: DepsProcessamento['ia'], extra: Partial<DepsProcessamento> = {}): DepsProcessamento {
  return {
    repos, ia, fila: new FilaFalsa(),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db, vi.fn().mockImplementation(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/ogg' } }))),
    transcritor: { modelo: 'whisper-large-v3-turbo', provedor: 'groq', transcrever: vi.fn().mockResolvedValue({ texto: 'oi', segundos: 5 }) },
    alertas: { alertar: async () => {} },
    relogio: () => new Date(),
    ...extra,
  };
}

/** A IA do roteiro e, depois dele, uma chamada que nunca volta: a vez "cai" ali (como o processo morto na implantação). */
class IaQueCai extends IaRoteirizada {
  override async criar(p: ParametrosIa): Promise<Anthropic.Message> {
    if (this.recebidos.length >= this.qtd) {
      this.caiu = true;
      return new Promise(() => {});
    }
    return super.criar(p);
  }
  caiu = false;
  constructor(private readonly qtd: number, roteiro: ConstructorParameters<typeof IaRoteirizada>[0]) { super(roteiro); }
}

async function ate(condicao: () => Promise<boolean> | boolean, ms = 10_000) {
  const fimEm = Date.now() + ms;
  while (!(await condicao())) {
    if (Date.now() > fimEm) throw new Error('condição não chegou');
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function receber(conversaId: string, idProvedor: string, conteudo: string) {
  await repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor, tipo: 'texto', conteudo });
}

async function conversaPronta() {
  const { conversa } = await contatoComEmpresas(['Indústria X']);
  await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
  return conversa;
}

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('retomada da vez interrompida (auditoria 4.1)', () => {
  it('(a) caiu depois de abrir_chamado: a nova execução não chama a IA, não abre outra demanda e passa à equipe', async () => {
    const conversa = await conversaPronta();
    await receber(conversa.id, 'M1', 'preciso da guia do DAS');
    const fiscal = await setorId('Fiscal');
    const ia1 = new IaQueCai(1, [usarFerramentas({ nome: 'abrir_chamado', entrada: { setor_id: fiscal, titulo: 'Guia DAS', resumo: 'x', fora_do_contrato: false } })]);
    void processarConversa(deps(ia1), conversa.id, false);
    await ate(() => ia1.caiu);
    expect(await repos.chamadosAbertosDaConversa(conversa.id)).toHaveLength(1);

    const ia2 = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá de novo!' } }), fim()]);
    expect(await processarConversa(deps(ia2), conversa.id, false)).toBe('escalado');
    expect(ia2.recebidos).toHaveLength(0);
    const chamados = await repos.chamadosAbertosDaConversa(conversa.id);
    expect(chamados).toHaveLength(1);
    expect(chamados[0]!.setor_id).toBe(fiscal);
    const c = await repos.obterConversa(conversa.id);
    expect(c.motivo_pessoa).toBe(MOTIVOS_PASSAGEM.interrompido);
    // Nenhuma resposta saiu naquele turno: o cliente recebe o aviso uma vez.
    expect(canal.enviados.map((e) => e.texto)).toEqual([AVISO_IA]);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(0);
  });

  it('(Review Focus 4) caiu depois de responder: sem resposta de novo nem aviso; a mensagem que chegou no meio entra na vez seguinte', async () => {
    const conversa = await conversaPronta();
    await receber(conversa.id, 'M1', 'oi');
    const ia1 = new IaQueCai(1, [usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } })]);
    void processarConversa(deps(ia1), conversa.id, false);
    await ate(() => ia1.caiu);
    await receber(conversa.id, 'M2', 'e o boleto?');

    const ia2 = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'O boleto já vai.' } }), fim()]);
    await processarConversa(deps(ia2), conversa.id, false);
    // A IA atende só a mensagem nova (M1 já foi respondida pelo turno que caiu e fica no histórico).
    expect(ia2.recebidos).toHaveLength(2);
    expect(JSON.stringify(ia2.recebidos[0]!.messages[0]!.content)).toContain('e o boleto?');
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Olá!', 'O boleto já vai.']);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(0);
    expect((await repos.obterConversa(conversa.id)).motivo_pessoa).toBe(MOTIVOS_PASSAGEM.interrompido);
  });

  it('(b) o turno anterior não fez nada (a IA falhou antes de agir): a nova execução chama a IA normalmente', async () => {
    const conversa = await conversaPronta();
    await receber(conversa.id, 'M1', 'oi');
    await db.from('mensagens').update({ turno_agente_entrada: crypto.randomUUID() }).eq('id_provedor', 'M1');
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('agente');
    expect(ia.recebidos).toHaveLength(2);
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Olá!']);
    // O lote ficou com o turno desta vez, o mesmo das decisões e da resposta.
    const { data: m } = await db.from('mensagens').select('turno_agente_entrada').eq('id_provedor', 'M1').single();
    const { data: s } = await db.from('mensagens').select('turno_agente').eq('direcao', 'saida').single();
    expect(m!.turno_agente_entrada).toBe(s!.turno_agente);
  });
});

describe('erro na escalada depois que o agente agiu (auditoria 4.6)', () => {
  it('responde, termina em max_tokens e abrir a Triagem falha duas vezes: não relança e marca as mensagens', async () => {
    const conversa = await conversaPronta();
    await receber(conversa.id, 'M1', 'oi');
    const cortado = { ...fim(), stop_reason: 'max_tokens', content: [] } as unknown as Anthropic.Message;
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), cortado]);
    const abrirChamado = vi.fn().mockRejectedValue(new Error('PostgREST fora'));
    const d = deps(ia, { repos: { ...repos, abrirChamado } });
    d.envio.repos = d.repos;
    expect(await processarConversa(d, conversa.id, false)).toBe('escalado');
    expect(abrirChamado).toHaveBeenCalledTimes(2);
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Olá!']);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(0);
  });
});

describe('mídia dentro do prazo da vez (auditoria 4.4)', () => {
  it('passado o prazo, as mídias restantes não são baixadas e viram aviso', async () => {
    const conversa = await conversaPronta();
    for (const id of ['A1', 'A2', 'A3']) {
      await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: id, tipo: 'audio', conteudo: null,
        midiaUrlOrigem: `https://f004.backblazeb2.com/${id}.ogg`, arquivoMime: 'audio/ogg' });
    }
    const real = Date.now.bind(Date);
    let desvio = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => real() + desvio);
    const transcrever = vi.fn().mockImplementation(async () => { desvio += PRAZO_VEZ_CONVERSA_MS / 2 + 1_000; return { texto: 'oi', segundos: 5 }; });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    await processarConversa(deps(ia, { transcritor: { modelo: 'w', provedor: 'groq', transcrever } }), conversa.id, false);
    expect(transcrever).toHaveBeenCalledTimes(2);
    const { data } = await db.from('mensagens').select('id_provedor, conteudo, arquivo_path').eq('id_provedor', 'A3').single();
    expect(data!.arquivo_path).toBeNull();
    expect(data!.conteudo).toContain('[anexo não aberto: tempo]');
    // O prazo venceu: a IA nem é chamada e a conversa vai à equipe (o prazo vale para a vez inteira).
    expect(ia.recebidos).toHaveLength(0);
  });
});

describe('trava renovada (auditoria 4.1, 4.4)', () => {
  it('(c) a vez segura a trava depois da validade original enquanto roda', async () => {
    let tomou: boolean | null = null;
    const r = await naVez(repos, 'conversa:renova', 2, async () => {
      await new Promise((res) => setTimeout(res, 3_500));
      // Relógio do banco: 3,5 s depois de uma trava de 2 s, outro dono ainda não consegue pegar.
      tomou = await repos.pegarTrava('conversa:renova', crypto.randomUUID(), 60);
      return 'ok';
    }, async () => {}, { renovarCadaMs: 500 });
    expect(r).toBe('ok');
    expect(tomou).toBe(false);
    // Terminou: a trava sai.
    expect(await repos.pegarTrava('conversa:renova', crypto.randomUUID(), 60)).toBe(true);
  });

  it('perdeu a trava (renovação falhou): o sinal da vez é abortado', async () => {
    let abortado = false;
    await naVez(repos, 'conversa:perde', 60, async (sinal) => {
      await db.from('travas_trabalhador').delete().eq('chave', 'conversa:perde');
      await ate(() => sinal.aborted, 3_000).catch(() => {});
      abortado = sinal.aborted;
    }, async () => {}, { renovarCadaMs: 200 });
    expect(abortado).toBe(true);
  });
});

describe('desligamento (auditoria 4.1)', () => {
  const bossFalso = () => {
    const parados: string[] = [];
    let parou = false;
    return { parados, parou: () => parou, boss: { offWork: async (n: unknown) => { parados.push(n as string); }, stop: async () => { parou = true; } } };
  };

  it('(d) para de pegar jobs, espera a vez de 1 s terminar e não deixa trava', async () => {
    const b = bossFalso();
    let terminou = false;
    const vez = naVez(repos, 'conversa:desliga', 1200, async () => { await new Promise((r) => setTimeout(r, 1_000)); terminou = true; return 'ok'; }, async () => {});
    await new Promise((r) => setTimeout(r, 100));
    const r = await encerrarComCalma(b.boss, repos, { esperaMs: 10_000 });
    expect(terminou).toBe(true);
    expect(r.terminaram).toBe(true);
    expect(b.parados).toEqual(expect.arrayContaining(Object.values(FILAS)));
    expect(b.parou()).toBe(true);
    expect(await vez).toBe('ok');
    expect(await repos.pegarTrava('conversa:desliga', crypto.randomUUID(), 60)).toBe(true);
  });

  it('a vez passa da espera: solta a trava deste processo antes de sair', async () => {
    const b = bossFalso();
    void naVez(repos, 'conversa:demora', 1200, () => new Promise(() => {}), async () => {});
    await new Promise((r) => setTimeout(r, 100));
    const r = await encerrarComCalma(b.boss, repos, { esperaMs: 300 });
    expect(r).toEqual({ terminaram: false, soltas: 1 });
    expect(await repos.pegarTrava('conversa:demora', crypto.randomUUID(), 60)).toBe(true);
  });
});

describe('batimento com a vez (auditoria 4.10)', () => {
  it('(e) conversa travada entre a consulta e a passagem: não passa à equipe', async () => {
    const conversa = await conversaPronta();
    await receber(conversa.id, 'P1', 'preciso da guia');
    const antes = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
    await db.from('mensagens').update({ criado_em: antes(30), reenfileirada: PARADA.maxDevolucoes, reenfileirada_em: antes(10) }).eq('id_provedor', 'P1');
    const consultar = repos.conversasComMensagemParada.bind(repos);
    const reposTravado = {
      ...repos,
      conversasComMensagemParada: async (de: number, ate: number) => {
        const r = await consultar(de, ate);
        // Uma vez da conversa começa logo depois da consulta.
        await repos.pegarTrava(`conversa:${conversa.id}`, crypto.randomUUID(), 60);
        return r;
      },
    };
    const d: DepsTarefas = {
      repos: reposTravado, canal, email: new EmailFalso(), fila: new FilaFalsa(), relogio: () => new Date(),
      envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) }, alertas: { alertar: async () => {} },
    };
    expect(await mensagensParadas(d)).toEqual({ devolvidas: 0, aEquipe: 0 });
    expect(await repos.chamadosAbertosDaConversa(conversa.id)).toHaveLength(0);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(1);
    expect(canal.enviados).toHaveLength(0);
  });
});

describe('limpeza de retenção (auditoria 4.17)', () => {
  it('(f) duas limpezas ao mesmo tempo: uma sai sem limpar', async () => {
    let rodadas = 0;
    const limpar = async () => { rodadas++; await new Promise((r) => setTimeout(r, 500)); return 'limpou'; };
    const [a, b] = await Promise.all([limpezaNaVez(repos, limpar), limpezaNaVez(repos, limpar)]);
    expect([a, b].sort()).toEqual(['limpou', 'ocupada']);
    expect(rodadas).toBe(1);
  });
});
