import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { executarAgente } from '../../src/agente/executar';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, db, repos, setorId } from '../apoio/cenario';
import { IaRoteirizada, fim, recusa, usarFerramentas } from '../apoio/ia-roteirizada';

const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;

function deps(ia: IaRoteirizada) {
  return { repos, ia, envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } };
}
async function contexto(conversaId: string, agora = SEGUNDA_10H) {
  const conversa = await repos.obterConversa(conversaId);
  const contato = conversa.contato_id ? await repos.buscarContato(conversa.telefone) : null;
  return carregarContexto(repos, conversa, contato, await repos.obterConfiguracoes(), agora);
}
const conteudo = [{ type: 'text' as const, text: '<mensagens_do_cliente>oi</mensagens_do_cliente>' }];

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
});

describe('executarAgente', () => {
  it('responde uma saudação e registra uso e decisão', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá, João! Como posso ajudar?' } }), fim()]);
    expect(await executarAgente(deps(ia), await contexto(conversa.id), conteudo)).toEqual({ status: 'ok' });
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Olá, João! Como posso ajudar?']);
    expect((await db.from('uso_ia').select('*')).data).toHaveLength(2);
    expect((await db.from('decisoes_agente').select('etapa')).data).toEqual([{ etapa: 'responder' }]);
  });

  it('cada parágrafo vira uma mensagem, no máximo 3 (o excedente vai junto na última)', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Bom dia!\n\nJá passei para o Fiscal.\n \nEles te retornam hoje.\n\nQualquer coisa, chama.' } }), fim()]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Bom dia!', 'Já passei para o Fiscal.', 'Eles te retornam hoje.\n\nQualquer coisa, chama.']);
  });

  it('usa o modelo de conversa configurado, com cache no prompt de sistema', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    const p = ia.recebidos[0]!;
    expect(p.model).toBe('claude-sonnet-5');
    expect(Array.isArray(p.system) && (p.system[0] as { cache_control?: object }).cache_control).toEqual({ type: 'ephemeral' });
  });

  it('recusa empresa que não pertence ao contato', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
    const { data: alheia } = await db.from('clientes').insert({ razao_social: 'Outra', cnpj: '99888777000166' }).select().single();
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'selecionar_empresa', entrada: { cliente_id: alheia!.id } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Não posso ajudar com essa empresa.' } }),
      fim(),
    ]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    expect(ia.recebidos[1]!.messages.at(-1)!.content).toMatchObject([{ type: 'tool_result', is_error: true }]);
    // Com uma empresa só, ela já é a empresa em foco; a alheia nunca entra no lugar dela.
    expect((await repos.obterConversa(conversa.id)).cliente_em_foco).toBe(empresas[0]!.id);
  });

  it('com duas empresas e nenhuma escolhida, não abre chamado', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X', 'Comércio Y']);
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'abrir_chamado', entrada: { setor_id: await setorId('Fiscal'), titulo: 'Guia', resumo: 'x', fora_do_contrato: false } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'É para a Indústria X ou para a Comércio Y?' } }),
      fim(),
    ]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    expect(ia.recebidos[1]!.messages.at(-1)!.content).toMatchObject([{ type: 'tool_result', is_error: true }]);
    expect((await db.from('chamados').select('*')).data).toHaveLength(0);
  });

  it('com uma empresa só, abre o chamado para o responsável do cliente naquele setor', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
    const fiscal = await setorId('Fiscal');
    const emailAna = `ana-${crypto.randomUUID()}@teste.local`;
    const { data: u } = await db.auth.admin.createUser({ email: emailAna, password: 'senha-forte-123', email_confirm: true });
    await db.from('usuarios').insert({ id: u.user!.id, nome: 'Ana', email: emailAna });
    await db.from('cliente_responsaveis').insert({ cliente_id: empresas[0]!.id, setor_id: fiscal, usuario_id: u.user!.id });
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'abrir_chamado', entrada: { setor_id: fiscal, titulo: 'Guia DAS setembro', resumo: 'Pediu a guia do DAS de setembro', fora_do_contrato: false } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Pronto! Abri o chamado.' } }),
      fim(),
    ]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    const { data: chamados } = await db.from('chamados').select('*');
    expect(chamados).toHaveLength(1);
    expect(chamados![0]).toMatchObject({ cliente_id: empresas[0]!.id, setor_id: fiscal, responsavel_id: u.user!.id });
    await db.auth.admin.deleteUser(u.user!.id);
  });

  it('fora do expediente, o resultado do chamado traz o aviso de horário', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'abrir_chamado', entrada: { setor_id: await setorId('Pessoal'), titulo: 'Holerite', resumo: 'x', fora_do_contrato: false } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'ok' } }),
      fim(),
    ]);
    const sabado = new Date('2026-09-26T13:00:00Z');
    await executarAgente(deps(ia), await contexto(conversa.id, sabado), conteudo);
    const resultado = JSON.parse((ia.recebidos[1]!.messages.at(-1)!.content as { content: string }[])[0]!.content);
    expect(resultado.fora_do_horario).toBe(true);
    expect(resultado.aviso_para_o_cliente).toContain('segunda a sexta');
  });

  it('número desconhecido só abre chamado de triagem', async () => {
    const conversa = await repos.obterOuCriarConversa('5531988887777', null);
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'abrir_chamado', entrada: { setor_id: await setorId('Fiscal'), titulo: 'Confirmar cadastro', resumo: 'Diz ser da Padaria Silva', fora_do_contrato: false } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Obrigado, já vamos confirmar seu cadastro.' } }),
      fim(),
    ]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    const { data } = await db.from('chamados').select('setor_id, cliente_id').single();
    expect(data).toEqual({ setor_id: null, cliente_id: null });
  });

  it('segunda triagem na mesma conversa complementa a primeira em vez de abrir outra', async () => {
    const conversa = await repos.obterOuCriarConversa('5531988887777', null);
    for (const resumo of ['Quer contratar o escritório', 'Nome: Thiago, empresa: Padaria Teste']) {
      const ia = new IaRoteirizada([
        usarFerramentas({ nome: 'abrir_chamado', entrada: { setor_id: 'triagem', titulo: 'Possível novo cliente', resumo, fora_do_contrato: false } }),
        usarFerramentas({ nome: 'responder', entrada: { texto: 'Já passei para a equipe.' } }),
        fim(),
      ]);
      await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    }
    const { data } = await db.from('chamados').select('id, resumo');
    expect(data).toHaveLength(1);
    expect(data![0]!.resumo).toBe('Quer contratar o escritório\n\nNome: Thiago, empresa: Padaria Teste');
    const { data: eventos } = await db.from('chamado_eventos').select('tipo').eq('chamado_id', data![0]!.id).order('criado_em');
    expect(eventos!.map((e) => e.tipo)).toEqual(['criacao', 'nota_interna']);
  });

  it('não envia nada se a conversa foi assumida por um atendente no meio do processamento', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const ctx = await contexto(conversa.id);
    await repos.atualizarConversa(conversa.id, { estado: 'humano' });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    await executarAgente(deps(ia), ctx, conteudo);
    expect(canal.enviados).toHaveLength(0);
  });

  it('recusa do modelo escala para humano', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const r = await executarAgente(deps(new IaRoteirizada([recusa()])), await contexto(conversa.id), conteudo);
    expect(r).toEqual({ status: 'escalar', motivo: 'refusal' });
  });

  it('terminar sem usar responder escala para humano', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const r = await executarAgente(deps(new IaRoteirizada([fim()])), await contexto(conversa.id), conteudo);
    expect(r).toEqual({ status: 'escalar', motivo: 'terminou sem responder' });
    expect(canal.enviados).toHaveLength(0);
  });

  it('para no limite de iterações', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const roteiro = Array.from({ length: 6 }, () => usarFerramentas({ nome: 'consultar_chamados', entrada: {} }));
    const r = await executarAgente(deps(new IaRoteirizada(roteiro)), await contexto(conversa.id), conteudo);
    expect(r).toEqual({ status: 'escalar', motivo: 'limite de iterações' });
  });

  it('duas mensagens não entendidas seguidas abrem chamado de triagem', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    for (let i = 0; i < 2; i++) {
      const ia = new IaRoteirizada([usarFerramentas({ nome: 'sinalizar_nao_entendido', entrada: {} }),
        usarFerramentas({ nome: 'responder', entrada: { texto: 'Pode explicar melhor?' } }), fim()]);
      await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    }
    const { data } = await db.from('chamados').select('setor_id, titulo');
    expect(data).toEqual([{ setor_id: null, titulo: 'Mensagem não compreendida pelo agente' }]);
    expect((await repos.obterConversa(conversa.id)).tentativas_nao_entendido).toBe(0);
  });
});
