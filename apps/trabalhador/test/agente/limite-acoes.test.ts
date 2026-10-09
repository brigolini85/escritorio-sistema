import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { executarAgente } from '../../src/agente/executar';
import { LIMITE_DEMANDAS, LIMITE_DOCUMENTOS, LIMITE_FERRAMENTAS_RODADA, LIMITE_RESPOSTAS, MENSAGEM_LIMITE_ACOES, ok, type ExecutorFerramentas } from '../../src/agente/ferramentas';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, db, repos, setorId } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';

// Auditoria 5.6: um atendimento não pode abrir demanda, responder ou mandar documento sem fim.
const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;

function deps(ia: IaRoteirizada) {
  return { repos, ia, envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } };
}
async function contexto(conversaId: string) {
  const conversa = await repos.obterConversa(conversaId);
  const contato = conversa.contato_id ? await repos.buscarContato(conversa.telefone) : null;
  return carregarContexto(repos, conversa, contato, await repos.obterConfiguracoes(), SEGUNDA_10H);
}
const conteudo = [{ type: 'text' as const, text: '<mensagens_do_cliente>oi</mensagens_do_cliente>' }];
const resultadosDa = (ia: IaRoteirizada, n: number) =>
  (ia.recebidos[n]!.messages.at(-1)!.content as { content: string; is_error?: boolean }[]);

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
});

describe('limite de ações por atendimento (auditoria 5.6)', () => {
  it('os limites são 4 demandas, 4 respostas, 3 documentos e 10 ferramentas por rodada', () => {
    expect([LIMITE_DEMANDAS, LIMITE_RESPOSTAS, LIMITE_DOCUMENTOS, LIMITE_FERRAMENTAS_RODADA]).toEqual([4, 4, 3, 10]);
  });

  it('6 abrir_chamado: 4 demandas abertas, a 5ª e a 6ª recusadas, e cada uma tem seu resultado', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const fiscal = await setorId('Fiscal');
    const pedido = (i: number) => ({ nome: 'abrir_chamado', entrada: { setor_id: fiscal, titulo: `Pedido ${i}`, resumo: 'x', fora_do_contrato: false } });
    const ia = new IaRoteirizada([
      usarFerramentas(...[1, 2, 3, 4, 5, 6].map(pedido)),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Passei para a equipe.' } }),
      fim(),
    ]);
    const r = await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    expect(r.status).toBe('ok');
    expect((await db.from('chamados').select('id')).data).toHaveLength(4);
    const res = resultadosDa(ia, 1);
    expect(res).toHaveLength(6);
    expect(res.slice(4).every((x) => x.is_error && x.content.includes('Limite de ações'))).toBe(true);
  });

  it('5 responder: só 4 chegam ao cliente', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const ia = new IaRoteirizada([
      usarFerramentas(...[1, 2, 3, 4, 5].map((i) => ({ nome: 'responder', entrada: { texto: `Mensagem ${i}` } }))),
      fim(),
    ]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Mensagem 1', 'Mensagem 2', 'Mensagem 3', 'Mensagem 4']);
  });

  it('4 enviar_documento: só 3 rodam', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    let rodou = 0;
    const executor: ExecutorFerramentas = async (_d, estado, nome) => { if (nome === 'responder') estado.respondeu = true; else rodou++; return ok({ enviado: true }); };
    const ia = new IaRoteirizada([
      usarFerramentas(...[1, 2, 3, 4].map((i) => ({ nome: 'enviar_documento', entrada: { documento_id: `d${i}` } }))),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Pronto.' } }),
      fim(),
    ]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo, executor);
    expect(rodou).toBe(3);
  });

  it('12 ferramentas numa rodada: as que passam de 10 são recusadas', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    let rodou = 0;
    const executor: ExecutorFerramentas = async () => { rodou++; return ok({}); };
    const ia = new IaRoteirizada([
      usarFerramentas(...Array.from({ length: 12 }, () => ({ nome: 'consultar_chamados', entrada: {} }))),
      fim(), fim(),
    ]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo, executor);
    expect(rodou).toBe(10);
    const res = resultadosDa(ia, 1);
    expect(res).toHaveLength(12);
    expect(res.slice(10).every((x) => x.is_error && x.content.includes(MENSAGEM_LIMITE_ACOES))).toBe(true);
  });

  it('o modelo insiste em outra rodada depois do limite: a vez é escalada', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const fiscal = await setorId('Fiscal');
    const pedido = (i: number) => ({ nome: 'abrir_chamado', entrada: { setor_id: fiscal, titulo: `Pedido ${i}`, resumo: 'x', fora_do_contrato: false } });
    const ia = new IaRoteirizada([
      usarFerramentas(...[1, 2, 3, 4, 5].map(pedido)),
      usarFerramentas(pedido(6)),
      fim(),
    ]);
    const r = await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    expect(r).toMatchObject({ status: 'escalar', motivo: 'limite de ações' });
    expect((await db.from('chamados').select('id')).data).toHaveLength(4);
  });
});
