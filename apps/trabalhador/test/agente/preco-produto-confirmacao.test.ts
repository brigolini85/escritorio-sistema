import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { FERRAMENTAS, executarFerramenta, validarEntrada, type EstadoExecucao } from '../../src/agente/ferramentas';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, criarCadastrosExemplo, db, definirAcessoTeste, repos, type CadastrosExemplo } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

/**
 * Auditoria 1.2, 5.4 e 1.7: preço e produto só mudam com o "sim" do cliente a uma pergunta que o sistema mandou, numa vez
 * seguinte, em até 30 min e uma vez só. Básico e contato arquivado não mudam nada (D1).
 */
const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;
let cad: CadastrosExemplo;
let estado: EstadoExecucao;
let conversaId: string;
let empresa: string;
let contatoId: string;

const d = () => ({ repos, ia: new IaRoteirizada([]), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const usar = async (nome: string, entrada: object) => {
  const r = await executarFerramenta(d(), estado, nome, entrada);
  return { ...JSON.parse(r.resultado), _erro: r.erro };
};
const novaVez = () => { estado.turno = randomUUID(); };
const clienteEscreve = (texto: string) =>
  repos.inserirMensagemEntrada({ conversaId, clienteId: empresa, tipo: 'texto', conteudo: texto, idProvedor: `ENT-${randomUUID()}` });
const vigente = async () => (await db.from('precos').select('valor, origem').eq('produto_id', cad.costela).eq('grupo_id', grupoBrasil).is('vigente_ate', null).single()).data;
const linhasDePreco = async () => (await db.from('precos').select('id').eq('produto_id', cad.costela).eq('grupo_id', grupoBrasil)).data!.length;
const enviadas = () => canal.enviados.map((e) => e.texto);
let grupoBrasil: string;

const pedirPreco = async (novo = 10) => {
  const r = await usar('alterar_preco', { unidade_id: cad.brasilEfigenia, produto_id: cad.costela, novo_valor: novo });
  expect(r).toMatchObject({ _erro: false, aguardando_cliente: true, instrucao: 'Aguarde a resposta do cliente; não chame de novo nesta vez.' });
  return r.confirmacao_id as string;
};
const lasanha = { codigo: '30', descricao: 'Lasanha Bolonhesa', unidade: 'pac', apelidos: ['lasanha'] };
const produtoGravado = async () => (await db.from('produtos').select('codigo, descricao, unidade, apelidos').eq('codigo', '30').maybeSingle()).data;

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  const { empresas, conversa } = await contatoComEmpresas(['Indústria X']);
  empresa = empresas[0]!.id;
  conversaId = conversa.id;
  cad = await criarCadastrosExemplo(empresa);
  grupoBrasil = (await db.from('parceiros_unidades').select('grupo_id').eq('id', cad.brasilEfigenia).single()).data!.grupo_id;
  const contato = await repos.buscarContato(conversa.telefone);
  contatoId = contato!.id;
  await db.from('contato_clientes').update({ pode_atualizar_preco: true }).eq('contato_id', contatoId);
  estado = { ctx: await carregarContexto(repos, conversa, contato, await repos.obterConfiguracoes(), SEGUNDA_10H), respondeu: false, turno: randomUUID() };
});

describe('alterar_preco em duas etapas (auditoria 1.2, 5.4)', () => {
  it('o esquema não tem mais confirmado_pelo_cliente; aceita os dados ou o confirmacao_id', () => {
    const def = FERRAMENTAS.find((f) => f.name === 'alterar_preco')!;
    expect(Object.keys(def.input_schema.properties!)).not.toContain('confirmado_pelo_cliente');
    expect(Object.keys(def.input_schema.properties!)).toContain('confirmacao_id');
    expect('erro' in validarEntrada('alterar_preco', { unidade_id: 'u', produto_id: 'p', novo_valor: 10 })).toBe(false);
    expect('erro' in validarEntrada('alterar_preco', { confirmacao_id: randomUUID() })).toBe(false);
    expect('erro' in validarEntrada('alterar_preco', { unidade_id: 'u', produto_id: 'p' })).toBe(true);
    expect('erro' in validarEntrada('alterar_preco', { confirmacao_id: randomUUID(), unidade_id: 'u', produto_id: 'p', novo_valor: 1 })).toBe(true);
  });

  it('(a) chamada com os dados (mesmo com confirmado_pelo_cliente): só grava a confirmação e o sistema manda a pergunta', async () => {
    const r = await usar('alterar_preco', { unidade_id: cad.brasilEfigenia, produto_id: cad.costela, novo_valor: 10, confirmado_pelo_cliente: true });
    expect(r).toMatchObject({ _erro: false, aguardando_cliente: true, confirmacao_id: expect.any(String) });
    expect(await vigente()).toEqual({ valor: 9.5, origem: 'painel' });
    expect(enviadas()).toEqual(['Confirma: Costela com Requeijão, rede Supermercado Brasil, de R$ 9,50 para R$ 10,00? Responda SIM para confirmar.']);
    const conf = (await db.from('confirmacoes_cliente').select('tipo, valor_antigo, contato_id, usado_em, criado_em, expira_em').single()).data!;
    expect(conf).toMatchObject({ tipo: 'preco', valor_antigo: 9.5, contato_id: contatoId, usado_em: null });
    expect(new Date(conf.expira_em).getTime() - new Date(conf.criado_em).getTime()).toBe(30 * 60_000);
    // A pergunta saiu como mensagem do agente, na conversa.
    expect((await db.from('mensagens').select('autor, direcao, status_envio').eq('conversa_id', conversaId).single()).data)
      .toEqual({ autor: 'agente', direcao: 'saida', status_envio: 'enviada' });
  });

  it('(b) confirmacao_id na mesma vez da pergunta: recusado, mesmo com uma mensagem do cliente no meio', async () => {
    const id = await pedirPreco();
    await clienteEscreve('sim');
    const r = await usar('alterar_preco', { confirmacao_id: id });
    expect(r).toMatchObject({ _erro: true, motivo: 'mesmo_turno' });
    expect(await vigente()).toEqual({ valor: 9.5, origem: 'painel' });
  });

  it('vez seguinte sem resposta do cliente depois da pergunta: recusado', async () => {
    const id = await pedirPreco();
    novaVez();
    expect(await usar('alterar_preco', { confirmacao_id: id })).toMatchObject({ _erro: true, motivo: 'sem_resposta' });
    expect(await vigente()).toEqual({ valor: 9.5, origem: 'painel' });
  });

  it('a entrada que chega enquanto a pergunta está saindo não confirma', async () => {
    const enviar = canal.enviarTexto.bind(canal);
    canal.enviarTexto = async (telefone: string, texto: string) => {
      await clienteEscreve('oi, tudo bem?');
      return enviar(telefone, texto);
    };
    const id = await pedirPreco();
    novaVez();
    expect(await usar('alterar_preco', { confirmacao_id: id })).toMatchObject({ _erro: true, motivo: 'sem_resposta' });
    expect(await vigente()).toEqual({ valor: 9.5, origem: 'painel' });
  });

  it('(c) depois de 31 min: recusado', async () => {
    const id = await pedirPreco();
    const antes = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    await db.from('confirmacoes_cliente').update({ criado_em: antes(31), expira_em: antes(1) }).eq('id', id);
    await db.from('mensagens').update({ criado_em: antes(31) }).eq('conversa_id', conversaId);
    await clienteEscreve('sim');
    novaVez();
    const r = await usar('alterar_preco', { confirmacao_id: id });
    expect(r).toMatchObject({ _erro: true, motivo: 'expirado' });
    expect(await vigente()).toEqual({ valor: 9.5, origem: 'painel' });
  });

  it('(d) preço mudou no painel entre a pergunta e o "sim": preco_mudou, sem gravar', async () => {
    const id = await pedirPreco();
    await db.from('precos').update({ valor: 9.9 }).eq('produto_id', cad.costela).eq('grupo_id', grupoBrasil).is('vigente_ate', null);
    await clienteEscreve('sim');
    novaVez();
    expect(await usar('alterar_preco', { confirmacao_id: id })).toMatchObject({ _erro: true, motivo: 'preco_mudou' });
    expect(await vigente()).toEqual({ valor: 9.9, origem: 'painel' });
    expect((await db.from('confirmacoes_cliente').select('usado_em').single()).data!.usado_em).toBeNull();
  });

  it('(e) "sim" e dois usos: uma linha nova em precos; o segundo diz que já foi gravado', async () => {
    const id = await pedirPreco();
    await clienteEscreve('sim');
    novaVez();
    const r1 = await usar('alterar_preco', { confirmacao_id: id });
    expect(r1).toMatchObject({ _erro: false, rede: 'Supermercado Brasil', produto: 'Costela com Requeijão', antes: 'R$ 9,50', depois: 'R$ 10,00' });
    const r2 = await usar('alterar_preco', { confirmacao_id: id });
    expect(r2).toMatchObject({ _erro: true, motivo: 'ja_usado' });
    expect(await vigente()).toEqual({ valor: 10, origem: 'agente' });
    expect(await linhasDePreco()).toBe(2);
    // Variação de 5%: sem alerta.
    expect((await db.from('alertas').select('id')).data).toHaveLength(0);
  });

  it('confirmacao_id de outra conversa ou inventado: recusado', async () => {
    novaVez();
    expect(await usar('alterar_preco', { confirmacao_id: randomUUID() })).toMatchObject({ _erro: true, motivo: 'nao_encontrado' });
  });

  it('variação maior que 30%: alerta de aviso para a equipe', async () => {
    const id = await pedirPreco(15);
    await clienteEscreve('sim');
    novaVez();
    expect((await usar('alterar_preco', { confirmacao_id: id }))._erro).toBe(false);
    expect((await db.from('alertas').select('nivel, mensagem')).data).toEqual([{
      nivel: 'aviso', mensagem: 'Preço de Costela com Requeijão (rede Supermercado Brasil) mudou mais de 30% pelo WhatsApp: R$ 9,50 → R$ 15,00.',
    }]);
  });

  it('(f) contato Básico com "pode mudar preço": não pergunta nada e não grava (D1)', async () => {
    await definirAcessoTeste(contatoId, empresa, { perfil: 'basico', podePedirNota: true, podeAtualizarPreco: true });
    const r = await usar('alterar_preco', { unidade_id: cad.brasilEfigenia, produto_id: cad.costela, novo_valor: 10 });
    expect(r._erro).toBe(true);
    expect(JSON.stringify(r)).toContain('sem permissão');
    expect(enviadas()).toEqual([]);
    expect((await db.from('confirmacoes_cliente').select('id')).data).toHaveLength(0);
    expect(await vigente()).toEqual({ valor: 9.5, origem: 'painel' });
  });

  it('(g) contato arquivado entre a pergunta e o "sim": recusado, sem gravar', async () => {
    const id = await pedirPreco();
    await clienteEscreve('sim');
    await db.from('contatos').update({ ativo: false }).eq('id', contatoId);
    novaVez();
    // O acesso de agora já trata o arquivado como Básico (sem fluxo de nota); o banco também recusaria (pgTAP 123).
    const r = await usar('alterar_preco', { confirmacao_id: id });
    expect(r.alterado).toBeUndefined();
    expect(await vigente()).toEqual({ valor: 9.5, origem: 'painel' });
    expect((await db.from('confirmacoes_cliente').select('usado_em').single()).data!.usado_em).toBeNull();
    // Mesmo que a trava do código falhe, o banco recusa o arquivado e desfaz o uso (auditoria 1.7).
    await expect(repos.usarConfirmacao(id, conversaId, contatoId, randomUUID())).rejects.toThrow('sem permissão');
    expect((await db.from('confirmacoes_cliente').select('usado_em').single()).data!.usado_em).toBeNull();
  });
});

describe('cadastrar_produto em duas etapas (auditoria 1.2, 5.4)', () => {
  it('o esquema não tem mais confirmado_pelo_cliente', () => {
    const def = FERRAMENTAS.find((f) => f.name === 'cadastrar_produto')!;
    expect(Object.keys(def.input_schema.properties!)).not.toContain('confirmado_pelo_cliente');
    expect(Object.keys(def.input_schema.properties!)).toContain('confirmacao_id');
  });

  it('dados: só pergunta; "sim" na vez seguinte: cadastra uma vez', async () => {
    const r = await usar('cadastrar_produto', { ...lasanha, confirmado_pelo_cliente: true });
    expect(r).toMatchObject({ _erro: false, aguardando_cliente: true });
    expect(enviadas()).toEqual(['Confirma o cadastro: código 30, Lasanha Bolonhesa, unidade PAC? Responda SIM para confirmar.']);
    expect(await produtoGravado()).toBeNull();
    expect(await usar('cadastrar_produto', { confirmacao_id: r.confirmacao_id })).toMatchObject({ _erro: true, motivo: 'mesmo_turno' });
    expect(await produtoGravado()).toBeNull();
    await clienteEscreve('sim, pode cadastrar');
    novaVez();
    expect(await usar('cadastrar_produto', { confirmacao_id: r.confirmacao_id })).toMatchObject({ _erro: false, cadastrado: true, codigo: '30', unidade: 'PAC' });
    expect(await produtoGravado()).toEqual({ codigo: '30', descricao: 'Lasanha Bolonhesa', unidade: 'PAC', apelidos: ['lasanha'] });
    expect(await usar('cadastrar_produto', { confirmacao_id: r.confirmacao_id })).toMatchObject({ _erro: true, motivo: 'ja_usado' });
  });

  it('código que já existe: recusa antes de perguntar', async () => {
    const r = await usar('cadastrar_produto', { ...lasanha, codigo: '12' });
    expect(r._erro).toBe(true);
    expect(JSON.stringify(r)).toContain('Já existe');
    expect(enviadas()).toEqual([]);
  });

  it('contato que vira Básico entre a pergunta e o "sim" não cadastra (D1, no banco)', async () => {
    const r = await usar('cadastrar_produto', lasanha);
    expect(r.aguardando_cliente).toBe(true);
    await clienteEscreve('sim');
    await definirAcessoTeste(contatoId, empresa, { perfil: 'basico', podePedirNota: true, podeAtualizarPreco: true });
    novaVez();
    expect((await usar('cadastrar_produto', { confirmacao_id: r.confirmacao_id }))._erro).toBe(true);
    expect(await produtoGravado()).toBeNull();
  });
});
