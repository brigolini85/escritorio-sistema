import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { AVISOS, executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { processarConversa, type DepsProcessamento } from '../../src/processar-conversa';
import { criarServidor } from '../../src/servidor';
import { contatoComEmpresas, db, definirAcessoTeste, repos } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import * as f from '../fixtures/zapi/sinteticos';

// Auditoria 1.4/3.9, 1.5, 1.6 e 1.10 (Task 11): a empresa em foco gravada na conversa só vale se ainda é do contato, em
// todo caminho; a Triagem de uma empresa não recebe o pedido de outra; o vínculo é relido ao trocar de empresa; número
// desconhecido não recebe no modelo a conversa do dono anterior do número.
const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
const TEL = '5531999990001'; // o mesmo do webhook de teste (fixtures/zapi/sinteticos)
const DIA_MS = 86_400_000;
let canal: CanalFalso;

function deps(ia: IaRoteirizada, agora = SEGUNDA_10H): DepsProcessamento {
  return {
    repos, ia, fila: new FilaFalsa(),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db),
    transcritor: { modelo: 'falso', provedor: 'groq', transcrever: vi.fn().mockResolvedValue({ texto: '', segundos: null }) },
    alertas: { alertar: async () => {} },
    relogio: () => agora,
  };
}
const dTool = () => ({ repos, ia: new IaRoteirizada([]), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const servidor = () => criarServidor({ canal: new CanalFalso(), repos, fila: new FilaFalsa(), segredo: 'segredo-com-16-caracteres', relogio: () => new Date() });
const semErro = <T extends { error: { message: string } | null }>(r: T): T => { if (r.error) throw new Error(r.error.message); return r; };

beforeEach(async () => {
  await limparBanco();
  semErro(await db.from('configuracoes').update({ agente_pausado: false }).eq('id', 1));
  canal = new CanalFalso();
});

describe('foco gravado de empresa que não é mais do contato (1.4, 3.9)', () => {
  it('vínculo com A apagado: a mensagem nova não leva A, nem a Triagem da equipe', async () => {
    const { conversa, contato, empresas } = await contatoComEmpresas(['Empresa A']);
    const a = empresas[0]!.id;
    semErro(await db.from('conversas').update({ cliente_em_foco: a }).eq('id', conversa.id));
    semErro(await db.from('contato_clientes').delete().eq('contato_id', contato.id).eq('cliente_id', a));

    const r = await servidor().inject({ method: 'POST', url: '/webhook/zapi/segredo-com-16-caracteres', payload: f.texto });
    expect(r.statusCode).toBe(200);
    const { data: m } = await db.from('mensagens').select('cliente_id').eq('conversa_id', conversa.id).single();
    expect(m!.cliente_id).toBeNull();

    // Agente pausado: encaminharParaHumano abre a Triagem.
    semErro(await db.from('configuracoes').update({ agente_pausado: true }).eq('id', 1));
    expect(await processarConversa(deps(new IaRoteirizada([])), conversa.id, false)).toBe('pausado');
    const { data: chs } = await db.from('chamados').select('cliente_id, setor_id').eq('conversa_id', conversa.id);
    expect(chs).toEqual([{ cliente_id: null, setor_id: null }]);
    expect((await repos.obterConversa(conversa.id)).cliente_em_foco).toBeNull();
  });

  it('carregarContexto grava null quando o foco não pertence mais ao contato', async () => {
    const { conversa, contato, empresas } = await contatoComEmpresas(['Empresa A', 'Empresa B', 'Empresa C']);
    semErro(await db.from('conversas').update({ cliente_em_foco: empresas[0]!.id }).eq('id', conversa.id));
    semErro(await db.from('contato_clientes').delete().eq('contato_id', contato.id).eq('cliente_id', empresas[0]!.id));
    const ctx = await carregarContexto(repos, await repos.obterConversa(conversa.id), await repos.buscarContato(TEL),
      await repos.obterConfiguracoes(), SEGUNDA_10H);
    expect(ctx.empresaEmFoco).toBeNull();
    expect((await repos.obterConversa(conversa.id)).cliente_em_foco).toBeNull();
  });

  it('obterOuCriarConversa zera o foco e grava a hora ao trocar de contato', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Empresa A']);
    semErro(await db.from('conversas').update({ cliente_em_foco: empresas[0]!.id }).eq('id', conversa.id));
    expect((await repos.obterOuCriarConversa(TEL, conversa.contato_id)).cliente_em_foco).toBe(empresas[0]!.id);
    semErro(await db.from('contatos').update({ ativo: false }).eq('id', conversa.contato_id!));
    // O número passou a outra pessoa, cadastrada sem o nono dígito (o arquivado continua com o telefone dele).
    const novo = semErro(await db.from('contatos').insert({ nome: 'Outra pessoa', telefone: '553199990001' }).select('id').single()).data!.id;
    const c = await repos.obterOuCriarConversa('553199990001', novo);
    expect(c.id).toBe(conversa.id);
    expect(c.contato_id).toBe(novo);
    expect(c.cliente_em_foco).toBeNull();
    expect(c.contato_trocado_em).not.toBeNull();
  });
});

describe('ferramentas', () => {
  let estado: EstadoExecucao;
  let a: string;
  let b: string;
  const usar = async (nome: string, entrada: object) => {
    const r = await executarFerramenta(dTool(), estado, nome, entrada);
    return { ...JSON.parse(r.resultado), _erro: r.erro };
  };
  beforeEach(async () => {
    const r = await contatoComEmpresas(['Empresa A', 'Empresa B']);
    [a, b] = [r.empresas[0]!.id, r.empresas[1]!.id];
    const ctx = await carregarContexto(repos, r.conversa, await repos.buscarContato(TEL), await repos.obterConfiguracoes(), SEGUNDA_10H);
    estado = { ctx, respondeu: false };
  });

  it('Triagem aberta de A com foco em B: a demanda nova é de B (1.5)', async () => {
    await usar('selecionar_empresa', { cliente_id: a });
    const triagem = { setor_id: 'triagem', titulo: 'Falar com alguém', resumo: 'Assunto da A.', fora_do_contrato: false, prioridade: 'normal' };
    const ra = await usar('abrir_chamado', triagem);
    await usar('selecionar_empresa', { cliente_id: b });
    const rb = await usar('abrir_chamado', { ...triagem, resumo: 'Assunto da B.' });
    expect(rb.numero).not.toBe(ra.numero);
    const { data } = await db.from('chamados').select('cliente_id, resumo').eq('conversa_id', estado.ctx.conversa.id).order('numero');
    expect(data!.map((c) => c.cliente_id)).toEqual([a, b]);
    expect(data![0]!.resumo).not.toContain('Assunto da B.');
  });

  it('selecionar_empresa com o vínculo apagado no meio da vez: empresa alheia, foco não muda (1.6)', async () => {
    await usar('selecionar_empresa', { cliente_id: a });
    semErro(await db.from('contato_clientes').delete().eq('contato_id', estado.ctx.contato!.id).eq('cliente_id', b));
    const r = await usar('selecionar_empresa', { cliente_id: b });
    expect(r).toEqual({ erro: AVISOS.empresaAlheia, _erro: true });
    expect((await repos.obterConversa(estado.ctx.conversa.id)).cliente_em_foco).toBe(a);
    expect(estado.ctx.empresaEmFoco?.id).toBe(a);
  });
});

describe('histórico de número desconhecido (1.10)', () => {
  const inserir = async (conversaId: string, conteudo: string, criadoEm: Date) => semErro(await db.from('mensagens').insert({
    conversa_id: conversaId, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo,
    criado_em: criadoEm.toISOString(), processada_em: new Date().toISOString(),
  }));
  const textoParaOModelo = async (conversaId: string, idProvedor: string, agora = SEGUNDA_10H) => {
    await repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor, tipo: 'texto', conteudo: 'bom dia' });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Bom dia! Como posso ajudar?' } }), fim()]);
    await processarConversa(deps(ia, agora), conversaId, false);
    return (ia.recebidos[0]!.messages[0]!.content as { text: string }[])[0]!.text;
  };

  it('contato arquivado e número com outra pessoa: as mensagens do contato antigo não vão ao modelo (revisão)', async () => {
    const { conversa, contato } = await contatoComEmpresas(['Empresa A']);
    await inserir(conversa.id, 'DO CONTATO ANTIGO: resumo da nota com CNPJ da empresa A', new Date(Date.now() - DIA_MS));
    await inserir(conversa.id, 'DO CONTATO ANTIGO: preço da costela', new Date(Date.now() - 60_000));
    // Arquivado pelo caminho de sempre (o painel muda ativo); ninguém grava a hora da troca à mão.
    semErro(await db.from('contatos').update({ ativo: false }).eq('id', contato.id));
    const texto = await textoParaOModelo(conversa.id, 'NOVA-1');
    expect(texto).not.toContain('DO CONTATO ANTIGO');
    expect(texto).toContain('bom dia');
  });

  it('número que nunca foi contato: só os últimos 30 dias (pelo relógio da vez)', async () => {
    // Relógio da vez 60 dias atrás: a conta usa ele (d.relogio), não a hora da máquina.
    const agora = new Date(Date.now() - 60 * DIA_MS);
    const conversa = await repos.obterOuCriarConversa('5531977770111', null);
    await inserir(conversa.id, 'ANTIGA: mensagem de 40 dias', new Date(agora.getTime() - 40 * DIA_MS));
    await inserir(conversa.id, 'RECENTE: mensagem de 5 dias', new Date(agora.getTime() - 5 * DIA_MS));
    const texto = await textoParaOModelo(conversa.id, 'NOVA-3', agora);
    expect(texto).toContain('RECENTE');
    expect(texto).not.toContain('ANTIGA');
  });

  it('contato conhecido continua com o histórico de sempre', async () => {
    const { conversa } = await contatoComEmpresas(['Empresa A']);
    await inserir(conversa.id, 'ANTIGA: pedido de nota', new Date(SEGUNDA_10H.getTime() - 40 * DIA_MS));
    expect(await textoParaOModelo(conversa.id, 'NOVA-2')).toContain('ANTIGA: pedido de nota');
  });
});

describe('Triagem automática por empresa (encaminharParaHumano, revisão da 1.5)', () => {
  it('Triagem aberta de A e foco em B: o agente pausado abre a Triagem de B', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Empresa A', 'Empresa B']);
    const [a, b] = [empresas[0]!.id, empresas[1]!.id];
    await repos.abrirChamado({ clienteId: a, conversaId: conversa.id, setorId: null, responsavelId: null, titulo: 'Triagem da A',
      resumo: 'x', foraDoContrato: false, origem: 'agente' });
    semErro(await db.from('conversas').update({ cliente_em_foco: b }).eq('id', conversa.id));
    semErro(await db.from('configuracoes').update({ agente_pausado: true }).eq('id', 1));
    await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: b, idProvedor: 'TRI-1', tipo: 'texto', conteudo: 'oi' });
    expect(await processarConversa(deps(new IaRoteirizada([])), conversa.id, false)).toBe('pausado');
    const { data } = await db.from('chamados').select('cliente_id, setor_id').eq('conversa_id', conversa.id).order('numero');
    expect(data).toEqual([{ cliente_id: a, setor_id: null }, { cliente_id: b, setor_id: null }]);
  });
});

describe('alterar_preco e cadastrar_produto leem o acesso uma vez (revisão)', () => {
  it('uma leitura de acessoDoContato por chamada, com as mesmas decisões', async () => {
    const r = await contatoComEmpresas(['Empresa A']);
    const a = r.empresas[0]!.id;
    let leituras = 0;
    const contado = { ...repos, acessoDoContato: async (c: string, e: string) => { leituras++; return repos.acessoDoContato(c, e); } };
    const ctx = await carregarContexto(repos, r.conversa, await repos.buscarContato(TEL), await repos.obterConfiguracoes(), SEGUNDA_10H);
    const estado: EstadoExecucao = { ctx, respondeu: false };
    const usar = async (nome: string, entrada: object) => {
      leituras = 0;
      const x = await executarFerramenta({ ...dTool(), repos: contado }, estado, nome, entrada);
      return { ...JSON.parse(x.resultado), _erro: x.erro, leituras };
    };
    const produto = { codigo: '30', descricao: 'Lasanha', unidade: 'PAC' };
    const preco = { unidade_id: '00000000-0000-0000-0000-000000000000', produto_id: '00000000-0000-0000-0000-000000000000', novo_valor: 10 };
    // Sem "pode mudar preço" (Fiscal marcado: fluxo de nota liberado): recusa de permissão.
    expect(await usar('alterar_preco', preco)).toMatchObject({ erro: AVISOS.precoSemPermissao, _erro: true, leituras: 1 });
    expect(await usar('cadastrar_produto', produto)).toMatchObject({ erro: AVISOS.produtoSemPermissao, _erro: true, leituras: 1 });
    // Básico: a mesma recusa de permissão (D1).
    await definirAcessoTeste(r.contato.id, a, { perfil: 'basico', podePedirNota: true, podeAtualizarPreco: true });
    expect(await usar('alterar_preco', preco)).toMatchObject({ erro: AVISOS.precoSemPermissao, _erro: true, leituras: 1 });
    expect(await usar('cadastrar_produto', produto)).toMatchObject({ erro: AVISOS.produtoSemPermissao, _erro: true, leituras: 1 });
    // Sem fluxo de nota (nem nota nem Fiscal): a instrução de abrir demanda.
    await definirAcessoTeste(r.contato.id, a, { perfil: 'rh_dp', setores: ['Pessoal'], podePedirNota: false, podeAtualizarPreco: true });
    expect(await usar('alterar_preco', preco)).toEqual({ instrucao: AVISOS.semFluxoNota, _erro: false, leituras: 1 });
  });
});
