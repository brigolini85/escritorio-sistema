import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repos } from '@escritorio/db';
import { configurarAgenteTeste, limparBanco } from '@escritorio/db/teste';
import { atenderComAgentes } from '../../src/agente/atender';
import { carregarContexto } from '../../src/agente/contexto';
import { executarAgente } from '../../src/agente/executar';
import { AVISOS_SETOR, executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { preAnaliseNaAbertura } from '../../src/agente/pre-analise';
import { AVISOS_AGENTE } from '../../src/agente/roteamento';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, db, definirAcessoTeste, repos, setorId } from '../apoio/cenario';
import { IaRoteirizada, fim, recusa, usarFerramentas } from '../apoio/ia-roteirizada';

const TEL = '5531999990001';
const NOITE = new Date('2026-10-05T23:30:00Z');   // fora do expediente
const DIA = new Date('2026-10-05T13:00:00Z');
let canal: CanalFalso;
const deps = (ia: IaRoteirizada, r: Repos = repos) => ({ repos: r, ia, envio: { repos: r, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const ctxDe = async (conversaId: string, agora = DIA) =>
  carregarContexto(repos, await repos.obterConversa(conversaId), await repos.buscarContato(TEL), await repos.obterConfiguracoes(), agora);

beforeEach(async () => { await limparBanco(); canal = new CanalFalso(); vi.restoreAllMocks(); });

describe('sobras da I2 (D24)', () => {
  it('(a) falha ao encerrar a condução depois que o agente devolveu não derruba a vez', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    const quebrado = { ...repos, encerrarConducao: async () => { throw new Error('banco fora'); } } as Repos;
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'devolver_ao_thiago', entrada: { motivo: 'assunto de outro setor' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Certo, já vejo isso para você.' } }), fim(),
    ]);
    await expect(atenderComAgentes(deps(ia, quebrado), await ctxDe(conversa.id), [{ type: 'text', text: 'e a folha?' }])).resolves.toEqual({ status: 'ok' });
    expect(erro).toHaveBeenCalled();
  });

  it('(a) também no escalar: o agente da condução recusa e a falha ao encerrar não derruba a vez (F12)', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    const quebrado = { ...repos, encerrarConducao: async () => { throw new Error('banco fora'); } } as Repos;
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ia = new IaRoteirizada([recusa()]);
    await expect(atenderComAgentes(deps(ia, quebrado), await ctxDe(conversa.id), [{ type: 'text', text: 'e a folha?' }]))
      .resolves.toMatchObject({ status: 'escalar' });
    expect(erro).toHaveBeenCalled();
  });

  it('(b) o agente do setor não alcança demanda que o contato não vê ("Fora do acesso" dele, e concluída)', async () => {
    const { conversa, contato, empresas } = await contatoComEmpresas(['Padaria Sol']);
    await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'mesma_voz', ferramentas: ['conferir_pedido_nota', 'nota_interna'] });
    const fiscal = await setorId('Fiscal');
    // F8: aberta no Fiscal, mas é a demanda "Fora do acesso" do próprio contato — demandaDoSetor acha, demandas_para_contato esconde.
    const aberta = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: fiscal, titulo: 'Pedido fora do acesso' } as never)
      .select('id, numero').single()).data!;
    const vinculo = await db.from('pedidos_fora_do_acesso').insert({ contato_id: contato.id, cliente_id: empresas[0]!.id, setor_id: fiscal, dia: '2026-10-05',
      chamado_id: aberta.id } as never);
    expect(vinculo.error).toBeNull();
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: fiscal, titulo: 'Guia', status: 'concluido',
      concluido_em: new Date().toISOString() } as never).select('numero').single()).data!;
    const ctx = await ctxDe(conversa.id);
    const estado: EstadoExecucao = { ctx, respondeu: false, agenteSetor: ctx.agentesSetor![0], modo: 'mesma_voz' };
    const r1 = await executarFerramenta(deps(new IaRoteirizada([])), estado, 'nota_interna', { numero: Number(aberta.numero), texto: 'x' });
    expect(JSON.parse(r1.resultado)).toEqual({ erro: AVISOS_SETOR.demandaNaoEncontrada });
    const r2 = await executarFerramenta(deps(new IaRoteirizada([])), estado, 'nota_interna', { numero: Number(ch.numero), texto: 'x' });
    expect(JSON.parse(r2.resultado)).toEqual({ erro: AVISOS_SETOR.demandaNaoEncontrada });
    expect((await db.from('agente_sugestoes').select('id')).data).toEqual([]);
  });

  it('(c) sugestão em demanda com pedido de nota exige o fluxo de nota do contato', async () => {
    const { conversa, contato, empresas } = await contatoComEmpresas(['Padaria Sol']);
    // Com o Fiscal marcado o contato já tem o fluxo de nota (podeFluxoNota): a regra só barra o agente de outro setor, numa demanda dele com pedido.
    await definirAcessoTeste(contato.id, empresas[0]!.id, { perfil: 'personalizado', setores: ['Pessoal'], podePedirNota: false });
    await configurarAgenteTeste('pessoal', { estado: 'ligado', modo: 'mesma_voz', ferramentas: ['nota_interna'] });
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, conversa_id: conversa.id, setor_id: await setorId('Pessoal'), titulo: 'NF de venda',
      pedido_venda: { unidade_id: null, texto_destinatario: 'X', data: '05/10/2026', itens: [] } } as never).select('numero').single()).data!;
    const ctx = await ctxDe(conversa.id);
    const estado: EstadoExecucao = { ctx, respondeu: false, agenteSetor: ctx.agentesSetor![0], modo: 'mesma_voz' };
    const r = JSON.parse((await executarFerramenta(deps(new IaRoteirizada([])), estado, 'nota_interna', { numero: Number(ch.numero), texto: 'x' })).resultado);
    expect(r.instrucao).toBeDefined();
    expect((await db.from('agente_sugestoes').select('id')).data).toEqual([]);
  });

  it('(d) Passa a conversa com ok: o Thiago não manda outra mensagem na mesma vez', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'chamar_agente', entrada: { agente: 'fiscal', assunto: 'outro', pedido: 'dúvida do DAS' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Aqui é do Fiscal do escritório, sigo com você.' } }), fim(),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Qualquer coisa estou aqui!' } }), fim(),
    ]);
    await executarAgente(deps(ia), await ctxDe(conversa.id), [{ type: 'text', text: 'por que o DAS veio alto?' }]);
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Aqui é do Fiscal do escritório, sigo com você.']);
    expect(ia.ultimosResultados()[0]!.content).toContain(AVISOS_AGENTE.conduzindo);
  });

  it('(e) com a trava ligada, o aviso de fora do expediente sai pelo sistema, uma vez', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'mesma_voz' });
    const fiscal = (await db.from('setores').select('id').eq('nome', 'Fiscal').single()).data!.id;
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'chamar_agente', entrada: { agente: 'fiscal', assunto: 'outro', pedido: 'nota' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Vou ver isso.' } }),
      usarFerramentas({ nome: 'devolver_ao_thiago', entrada: { motivo: 'precisa de demanda' } }),
      usarFerramentas({ nome: 'abrir_chamado', entrada: { setor_id: fiscal, titulo: 'Nota', resumo: 'Pedido de nota', fora_do_contrato: false,
        prioridade: 'normal', pede_valores: false } }), fim(),
    ]);
    await executarAgente(deps(ia), await ctxDe(conversa.id, NOITE), [{ type: 'text', text: 'preciso de uma nota' }]);
    const config = await repos.obterConfiguracoes();
    expect(canal.enviados).toHaveLength(2);
    expect(canal.enviados[1]!.texto).toContain(config.mensagens.fora_do_horario!.slice(0, 20));
  });

  it('(f) a pré-análise acha o agente que acabou de devolver a condução', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Padaria Sol']);
    await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa', ferramentas: ['conferir_pedido_nota'] });
    const base = await ctxDe(conversa.id);
    const fiscal = base.agentesSetor![0]!;
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: fiscal.setorId, titulo: 'NF de venda',
      pedido_venda: { unidade_id: null, texto_destinatario: 'X', data: '05/10/2026', itens: [] } } as never).select('id').single()).data!;
    // Como semAgente deixa o contexto depois da devolução: fora da lista do Thiago, mas lembrado como quem devolveu.
    const estado: EstadoExecucao = { ctx: { ...base, agentesSetor: [], agenteDevolvido: fiscal }, respondeu: false };
    await preAnaliseNaAbertura(deps(new IaRoteirizada([])), estado, ch.id, fiscal.setorId);
    expect((await db.from('pre_analises_nota').select('chamado_id')).data).toEqual([{ chamado_id: ch.id }]);
  });
});
