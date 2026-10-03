import { MOTIVOS_PASSAGEM, motivoDaEscalada } from '@escritorio/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio } from '../src/envio';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { processarConversa, type DepsProcessamento } from '../src/processar-conversa';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId } from './apoio/cenario';
import { FilaFalsa } from './apoio/fila-falsa';
import { IaRoteirizada, fim, recusa, usarFerramentas } from './apoio/ia-roteirizada';

const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;

function deps(ia: IaRoteirizada): DepsProcessamento {
  return {
    repos, ia, fila: new FilaFalsa(),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db),
    transcritor: { transcrever: vi.fn().mockResolvedValue('') },
    alertas: { alertar: async () => {} },
    relogio: () => SEGUNDA_10H,
  };
}
let seq = 0;
const receber = (conversaId: string, conteudo: string) =>
  repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor: `P${++seq}`, tipo: 'texto', conteudo, midiaUrlOrigem: null, arquivoMime: null });
const conversaAtual = (id: string) => repos.obterConversa(id);

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
});

describe('motivo da passagem em cada caminho (spec 7A.2)', () => {
  it('cliente pede uma pessoa: passar_para_pessoa marca, abre triagem e o agente avisa o cliente', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await receber(conversa.id, 'quero falar com uma pessoa');
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'passar_para_pessoa', entrada: { motivo: 'quer tratar da folha' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Já chamei alguém da equipe.' } }),
      fim(),
    ]);
    await processarConversa(deps(ia), conversa.id, false);
    const c = await conversaAtual(conversa.id);
    expect(c.motivo_pessoa).toBe(MOTIVOS_PASSAGEM.pedidoCliente);
    expect(c.aguardando_pessoa_desde).not.toBeNull();
    const abertas = await repos.chamadosAbertosDaConversa(conversa.id);
    expect(abertas.map((d) => [d.titulo, d.resumo, d.setor_id])).toEqual([['Cliente pediu para falar com uma pessoa', 'quer tratar da folha', null]]);
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Já chamei alguém da equipe.']);
  });

  it('passar_para_pessoa com demanda aberta na conversa não abre outra', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
    await repos.abrirChamado({ clienteId: empresas[0]!.id, conversaId: conversa.id, setorId: await setorId('Fiscal'), responsavelId: null,
      titulo: 'Guia', resumo: 'x', foraDoContrato: false, origem: 'agente' });
    await receber(conversa.id, 'quero falar com alguém');
    // Com o responder: sem ele o roteiro acaba no lembrete e o caminho de falha abre a própria demanda de Triagem.
    await processarConversa(deps(new IaRoteirizada([usarFerramentas({ nome: 'passar_para_pessoa', entrada: { motivo: 'guia' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Já chamei alguém da equipe.' } }), fim()])), conversa.id, false);
    expect((await repos.chamadosAbertosDaConversa(conversa.id)).map((d) => d.titulo)).toEqual(['Guia']);
    expect((await conversaAtual(conversa.id)).motivo_pessoa).toBe(MOTIVOS_PASSAGEM.pedidoCliente);
  });

  it('não entendeu duas vezes: marca só na segunda', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const rodada = () => new IaRoteirizada([usarFerramentas({ nome: 'sinalizar_nao_entendido', entrada: {} }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Pode explicar de novo?' } }), fim()]);
    await receber(conversa.id, 'asdkj');
    await processarConversa(deps(rodada()), conversa.id, false);
    expect((await conversaAtual(conversa.id)).motivo_pessoa).toBeNull();
    await receber(conversa.id, 'qwepo');
    await processarConversa(deps(rodada()), conversa.id, false);
    expect((await conversaAtual(conversa.id)).motivo_pessoa).toBe(MOTIVOS_PASSAGEM.naoEntendeu);
  });

  it('contato com o agente desligado: motivo de pausa do contato', async () => {
    const { conversa, contato } = await contatoComEmpresas(['Indústria X']);
    await db.from('contatos').update({ agente_pausado: true }).eq('id', contato.id);
    await receber(conversa.id, 'oi');
    await processarConversa(deps(new IaRoteirizada([])), conversa.id, false);
    expect((await conversaAtual(conversa.id)).motivo_pessoa).toBe(MOTIVOS_PASSAGEM.pausaContato);
  });

  it('empresa pausada: motivo de pausa da empresa', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
    await db.from('clientes').update({ agente_pausado: true }).eq('id', empresas[0]!.id);
    await receber(conversa.id, 'oi');
    await processarConversa(deps(new IaRoteirizada([])), conversa.id, false);
    expect((await conversaAtual(conversa.id)).motivo_pessoa).toBe(MOTIVOS_PASSAGEM.pausaEmpresa);
  });

  it('pausa geral: motivo geral', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await db.from('configuracoes').update({ agente_pausado: true }).eq('id', 1);
    await receber(conversa.id, 'oi');
    await processarConversa(deps(new IaRoteirizada([])), conversa.id, false);
    expect((await conversaAtual(conversa.id)).motivo_pessoa).toBe(MOTIVOS_PASSAGEM.pausaGeral);
  });

  it('teto de IA atingido: motivo de teto', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await db.from('configuracoes').update({ teto_ia_usd: 0 }).eq('id', 1);
    await receber(conversa.id, 'oi');
    await processarConversa(deps(new IaRoteirizada([])), conversa.id, false);
    expect((await conversaAtual(conversa.id)).motivo_pessoa).toBe(MOTIVOS_PASSAGEM.teto);
  });

  it('escalada (recusa do modelo): motivo da escalada', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await receber(conversa.id, 'oi');
    await processarConversa(deps(new IaRoteirizada([recusa()])), conversa.id, false);
    expect((await conversaAtual(conversa.id)).motivo_pessoa).toBe(motivoDaEscalada('refusal'));
  });

  it('falha da IA na última tentativa: motivo de falha', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await receber(conversa.id, 'oi');
    await processarConversa(deps(new IaRoteirizada([new Error('fora do ar')])), conversa.id, true);
    expect((await conversaAtual(conversa.id)).motivo_pessoa).toBe(MOTIVOS_PASSAGEM.falha);
  });

  it('conversa assumida: nada é marcado (foco da revisão 4)', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { estado: 'humano' });
    await receber(conversa.id, 'oi');
    await processarConversa(deps(new IaRoteirizada([])), conversa.id, false);
    expect((await conversaAtual(conversa.id)).aguardando_pessoa_desde).toBeNull();
  });

  it('resposta normal não marca passagem', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await receber(conversa.id, 'oi');
    await processarConversa(deps(new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi!' } }), fim()])), conversa.id, false);
    expect((await conversaAtual(conversa.id)).aguardando_pessoa_desde).toBeNull();
  });
});

describe('turno e documento (o "por quê?" e o link do painel)', () => {
  it('mensagens e decisões de uma execução têm o mesmo turno; outra execução, outro turno', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const responde = (texto: string) => new IaRoteirizada([usarFerramentas({ nome: 'consultar_chamados', entrada: {} }),
      usarFerramentas({ nome: 'responder', entrada: { texto } }), fim()]);
    await receber(conversa.id, 'oi');
    await processarConversa(deps(responde('Primeira')), conversa.id, false);
    await receber(conversa.id, 'e aí');
    await processarConversa(deps(responde('Segunda')), conversa.id, false);
    const msgs = (await db.from('mensagens').select('conteudo, turno_agente').eq('conversa_id', conversa.id).eq('autor', 'agente').order('criado_em')).data!;
    const decisoes = (await db.from('decisoes_agente').select('etapa, turno').eq('conversa_id', conversa.id).order('criado_em')).data!;
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.turno_agente).not.toBeNull();
    expect(msgs[0]!.turno_agente).not.toBe(msgs[1]!.turno_agente);
    expect(decisoes.filter((d) => d.turno === msgs[0]!.turno_agente).map((d) => d.etapa)).toEqual(['consultar_chamados', 'responder']);
  });

  it('documento enviado pela IA fica ligado à mensagem', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
    const c = await criarCadastrosExemplo(empresas[0]!.id);
    await db.from('documentos_empresa').update({ ia_pode_enviar: true }).eq('id', c.contrato);
    await receber(conversa.id, 'me manda o contrato social');
    await processarConversa(deps(new IaRoteirizada([usarFerramentas({ nome: 'enviar_documento', entrada: { documento_id: c.contrato } }), fim()])), conversa.id, false);
    const m = (await db.from('mensagens').select('documento_id, turno_agente').eq('conversa_id', conversa.id).eq('autor', 'agente').single()).data!;
    expect(m.documento_id).toBe(c.contrato);
    expect(m.turno_agente).not.toBeNull();
  });
});
