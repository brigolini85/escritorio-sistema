import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { TEXTO_FORA_DO_ACESSO, tituloSemValores } from '../../src/agente/acesso';
import { carregarContexto } from '../../src/agente/contexto';
import { AVISOS, executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { avisoAoSocio, diaEmSaoPaulo } from '../../src/agente/fora-do-acesso';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, criarCadastrosExemplo, db, definirAcessoTeste, repos, setorId } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

// Parte H2 (spec 7D.2, D13–D15): pedido fora do acesso → resposta neutra fixa, nada revelado, demanda com nota no setor
// e aviso ao(s) sócio(s); um por contato, empresa, setor e dia.
const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
const TEL_CARLA = '5511977772211';
const TEL_ROBERTO = '5511988880001';
let canal: CanalFalso;
let estado: EstadoExecucao;
let rede: string;
let carla: string;
let roberto: string;
// Repositório das ferramentas: o de verdade, ou um que simula outra tentativa ao mesmo tempo.
let rp: typeof repos;
const d = () => ({ repos: rp, ia: new IaRoteirizada([]), envio: { repos: rp, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const usar = async (nome: string, entrada: object) => JSON.parse((await executarFerramenta(d(), estado, nome, entrada)).resultado);
const pedirFolha = async () => usar('abrir_chamado', {
  setor_id: await setorId('Pessoal'), titulo: 'Folha de setembro', resumo: 'A Carla pediu a folha de pagamento de setembro.',
  fora_do_contrato: false, prioridade: 'normal', pede_valores: true,
});
const paraCarla = () => canal.enviados.filter((e) => e.telefone === TEL_CARLA).map((e) => e.texto);
const paraRoberto = () => canal.enviados.filter((e) => e.telefone === TEL_ROBERTO).map((e) => e.texto);
// Preparo que falha em silêncio mediria outra coisa (revisão da Task 5).
const semErro = <T extends { error: { message: string } | null }>(r: T): T => { if (r.error) throw new Error(r.error.message); return r; };

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  rp = repos;
  const r = await contatoComEmpresas(['Rede Bom Preço'], TEL_CARLA,
    { perfil: 'compras_vendas', setores: ['Fiscal'], procurado: ['Fiscal'], podePedirNota: true, podeAtualizarPreco: true, receberDocumentos: true });
  rede = r.empresas[0]!.id;
  carla = r.contato.id;
  semErro(await db.from('contatos').update({ nome: 'Carla Mendes' }).eq('id', r.contato.id));
  roberto = semErro(await db.from('contatos').insert({ nome: 'Roberto Faria', telefone: TEL_ROBERTO }).select('id').single()).data!.id;
  semErro(await db.from('contato_clientes').insert({ contato_id: roberto, cliente_id: rede }));
  await definirAcessoTeste(roberto, rede, { perfil: 'socio', setores: 'todos', verValores: true, receberDocumentos: true, recebeAlertasAcesso: true });
  const ctx = await carregarContexto(repos, r.conversa, await repos.buscarContato(TEL_CARLA), await repos.obterConfiguracoes(), SEGUNDA_10H);
  estado = { ctx, respondeu: false };
});

describe('Carla (Compras, só Fiscal) pede a folha', () => {
  it('resposta neutra fixa ao cliente; o modelo só sabe que já foi respondido', async () => {
    expect(await pedirFolha()).toEqual({ fora_do_acesso: true, resposta_enviada: true, instrucao: AVISOS.instrucaoForaDoAcesso });
    expect(paraCarla()).toEqual([TEXTO_FORA_DO_ACESSO]);
    expect(estado.respondeu).toBe(true);
  });
  it('demanda "Fora do acesso" no Pessoal, com a nota interna que explica e quem foi avisado', async () => {
    await pedirFolha();
    const { data: ch } = await db.from('chamados').select('id, titulo, resumo, setores(nome), conversa_id').eq('cliente_id', rede).single();
    expect(ch).toMatchObject({ titulo: 'Fora do acesso: Folha de setembro', resumo: 'A Carla pediu a folha de pagamento de setembro.', setores: { nome: 'Pessoal' } });
    expect(ch!.conversa_id).toBe(estado.ctx.conversa.id);
    const { data: notas } = await db.from('chamado_eventos').select('texto').eq('chamado_id', ch!.id).eq('tipo', 'nota_interna');
    expect(notas!.map((n) => n.texto)).toEqual([expect.stringContaining('Avisados pelo WhatsApp: Roberto Faria.')]);
    expect(notas![0]!.texto).toContain('Carla Mendes (Compras/Vendas)');
  });
  it('avisa o sócio na conversa dele, com o setor e sem o conteúdo', async () => {
    await pedirFolha();
    expect(paraRoberto()).toEqual([avisoAoSocio({ socio: 'Roberto Faria', contato: 'Carla Mendes', setor: 'Pessoal', empresa: 'Rede Bom Preço', motivo: 'setor' })]);
    expect(paraRoberto()[0]).toContain('um assunto do Pessoal');
    expect(paraRoberto()[0]).not.toContain('folha');
  });
  it('um aviso por assunto por dia: de novo no mesmo dia → recusa de novo, nota "pediu de novo", sem novo aviso', async () => {
    await pedirFolha();
    estado.recusou = false; // outro turno
    await pedirFolha();
    expect(paraCarla()).toEqual([TEXTO_FORA_DO_ACESSO, TEXTO_FORA_DO_ACESSO]);
    expect(paraRoberto()).toHaveLength(1);
    const { data: chs } = await db.from('chamados').select('id').eq('cliente_id', rede);
    expect(chs).toHaveLength(1);
    const { data: notas } = await db.from('chamado_eventos').select('texto').eq('chamado_id', chs![0]!.id).eq('tipo', 'nota_interna').order('criado_em');
    expect(notas!.at(-1)!.texto).toMatch(/^Pediu de novo: /);
  });
  it('no mesmo turno, a resposta neutra sai uma vez só', async () => {
    await pedirFolha();
    await usar('abrir_chamado', { setor_id: await setorId('Contábil'), titulo: 'Balanço', resumo: 'Pediu o balanço.', fora_do_contrato: false, prioridade: 'normal' });
    expect(paraCarla()).toEqual([TEXTO_FORA_DO_ACESSO]);
  });
  it('sem ninguém marcado para alertas: só a demanda no setor', async () => {
    await definirAcessoTeste(roberto, rede, { perfil: 'socio', setores: 'todos', recebeAlertasAcesso: false });
    await pedirFolha();
    expect(paraRoberto()).toEqual([]);
    const { data: ch } = await db.from('chamados').select('id').eq('cliente_id', rede).single();
    const { data: notas } = await db.from('chamado_eventos').select('texto').eq('chamado_id', ch!.id).eq('tipo', 'nota_interna');
    expect(notas![0]!.texto).toContain('A empresa não tem ninguém marcado para receber alertas de acesso');
  });
  it('falha no aviso não impede a recusa e fica na nota', async () => {
    canal.falharEnvio = false;
    const original = canal.enviarTexto.bind(canal);
    canal.enviarTexto = async (tel, texto) => { if (tel === TEL_ROBERTO) throw new Error('falha simulada'); return original(tel, texto); };
    await pedirFolha();
    expect(paraCarla()).toEqual([TEXTO_FORA_DO_ACESSO]);
    const { data: ch } = await db.from('chamados').select('id').eq('cliente_id', rede).single();
    const { data: notas } = await db.from('chamado_eventos').select('texto').eq('chamado_id', ch!.id).eq('tipo', 'nota_interna');
    expect(notas![0]!.texto).toContain('Aviso não enviado para: Roberto Faria.');
  });
  it('quem pediu nunca recebe o aviso, mesmo marcada para alertas', async () => {
    await definirAcessoTeste(carla, rede, { perfil: 'compras_vendas', setores: ['Fiscal'], podePedirNota: true, recebeAlertasAcesso: true });
    await pedirFolha();
    expect(paraCarla()).toEqual([TEXTO_FORA_DO_ACESSO]);
    expect(paraRoberto()).toHaveLength(1);
    const { data: ch } = await db.from('chamados').select('id').eq('cliente_id', rede).single();
    const { data: notas } = await db.from('chamado_eventos').select('texto').eq('chamado_id', ch!.id).eq('tipo', 'nota_interna');
    expect(notas![0]!.texto).toContain('Avisados pelo WhatsApp: Roberto Faria.');
    expect(notas![0]!.texto).not.toContain('Avisados pelo WhatsApp: Carla');
  });
  it('registro do dia sem demanda (tentativa anterior que caiu): cria a demanda agora', async () => {
    const pessoal = await setorId('Pessoal');
    semErro(await db.from('pedidos_fora_do_acesso').insert({ contato_id: carla, cliente_id: rede, setor_id: pessoal, dia: '2026-09-28' }));
    await pedirFolha();
    expect(paraCarla()).toEqual([TEXTO_FORA_DO_ACESSO]);
    const { data: ch } = await db.from('chamados').select('id, titulo').eq('cliente_id', rede).single();
    expect(ch!.titulo).toBe('Fora do acesso: Folha de setembro');
    const { data: notas } = await db.from('chamado_eventos').select('texto').eq('chamado_id', ch!.id).eq('tipo', 'nota_interna');
    expect(notas!.map((n) => n.texto)).toEqual([expect.stringContaining('Carla Mendes (Compras/Vendas)')]);
    const { data: reg } = await db.from('pedidos_fora_do_acesso').select('chamado_id').eq('contato_id', carla).single();
    expect(reg!.chamado_id).toBe(ch!.id);
  });
  it('o dia do registro é o de São Paulo (23h30 de terça ainda é terça)', async () => {
    estado.ctx.agora = new Date('2026-10-14T02:30:00Z');
    await pedirFolha();
    const { data } = await db.from('pedidos_fora_do_acesso').select('dia').eq('contato_id', carla).single();
    expect(data!.dia).toBe('2026-10-13');
  });
  it('setor que a empresa nem contrata e que não está marcado: recusa também', async () => {
    const servico = semErro(await db.from('servicos').upsert({ nome: 'Escrita fiscal (teste H2)', setor_id: await setorId('Fiscal') }, { onConflict: 'nome' })
      .select('id').single()).data!.id;
    semErro(await db.from('cliente_servicos').insert({ cliente_id: rede, servico_id: servico }));
    const r = await usar('abrir_chamado', { setor_id: await setorId('Legalização'), titulo: 'Alteração contratual', resumo: 'Quer mudar o endereço.', fora_do_contrato: true, prioridade: 'normal', pede_valores: false });
    expect(r).toEqual({ fora_do_acesso: true, resposta_enviada: true, instrucao: AVISOS.instrucaoForaDoAcesso });
    expect(paraCarla()).toEqual([TEXTO_FORA_DO_ACESSO]);
    const { data } = await db.from('chamados').select('titulo, setores(nome)').eq('cliente_id', rede).single();
    expect(data).toMatchObject({ titulo: 'Fora do acesso: Alteração contratual', setores: { nome: 'Legalização' } });
  });
  it('outra tentativa ligou a demanda antes: "Pediu de novo" na dela, a repetida sai da fila e ninguém é avisado de novo', async () => {
    const pessoal = await setorId('Pessoal');
    // O registro do dia já existe sem demanda (a outra tentativa ainda está abrindo a dela).
    semErro(await db.from('pedidos_fora_do_acesso').insert({ contato_id: carla, cliente_id: rede, setor_id: pessoal, dia: '2026-09-28' }));
    const outra = semErro(await db.from('chamados').insert({ cliente_id: rede, setor_id: pessoal, titulo: 'Fora do acesso: Folha (outra tentativa)' })
      .select('id').single()).data!.id;
    rp = {
      ...repos,
      vincularPedidoForaDoAcesso: async (id: string, chamadoId: string) => {
        semErro(await db.from('pedidos_fora_do_acesso').update({ chamado_id: outra }).eq('id', id)); // a outra ganhou a corrida
        return repos.vincularPedidoForaDoAcesso(id, chamadoId);
      },
    };
    await pedirFolha();
    expect(paraCarla()).toEqual([TEXTO_FORA_DO_ACESSO]);
    expect(paraRoberto()).toEqual([]);
    const { data: reg } = await db.from('pedidos_fora_do_acesso').select('chamado_id, socios_avisados').eq('contato_id', carla).single();
    expect(reg).toEqual({ chamado_id: outra, socios_avisados: 0 });
    const { data: notasOutra } = await db.from('chamado_eventos').select('texto').eq('chamado_id', outra).eq('tipo', 'nota_interna');
    expect(notasOutra!.map((n) => n.texto)).toEqual(['Pediu de novo: A Carla pediu a folha de pagamento de setembro.']);
    const { data: repetida } = await db.from('chamados').select('id, status').eq('cliente_id', rede).eq('titulo', 'Fora do acesso: Folha de setembro').single();
    expect(repetida!.status).toBe('concluido');
    const { data: notasRepetida } = await db.from('chamado_eventos').select('texto').eq('chamado_id', repetida!.id).eq('tipo', 'nota_interna');
    expect(notasRepetida!.map((n) => n.texto)).toEqual([expect.stringContaining('Demanda repetida')]);
  });
  it('conversa assumida por uma pessoa: nada sai do agente, mas a demanda e o aviso continuam', async () => {
    semErro(await db.from('conversas').update({ estado: 'humano' }).eq('id', estado.ctx.conversa.id));
    expect(await pedirFolha()).toEqual({ fora_do_acesso: true, resposta_enviada: true, instrucao: AVISOS.instrucaoForaDoAcesso });
    expect(paraCarla()).toEqual([]);
    expect(estado.respondeu).toBe(false);
    expect(paraRoberto()).toHaveLength(1);
    expect((await db.from('chamados').select('titulo').eq('cliente_id', rede).single()).data!.titulo).toBe('Fora do acesso: Folha de setembro');
  });
});

describe('recusa por valores num setor do próprio contato', () => {
  const pedirValorDaGuia = async () => usar('abrir_chamado', {
    setor_id: await setorId('Fiscal'), titulo: 'Valor da guia', resumo: 'Quanto ficou a guia?', fora_do_contrato: false, prioridade: 'normal', pede_valores: true,
  });
  it('a nota interna diz que falta "Ver valores"', async () => {
    await pedirValorDaGuia();
    const { data: ch } = await db.from('chamados').select('id, setores(nome)').eq('cliente_id', rede).single();
    expect(ch!.setores).toEqual({ nome: 'Fiscal' });
    const { data: notas } = await db.from('chamado_eventos').select('texto').eq('chamado_id', ch!.id).eq('tipo', 'nota_interna');
    expect(notas![0]!.texto).toContain('Carla Mendes (Compras/Vendas) não tem "Ver valores" na empresa Rede Bom Preço.');
    expect(notas![0]!.texto).not.toContain('não pode tratar deste setor');
  });
  it('consultar_chamados nos turnos seguintes não mostra a demanda "Fora do acesso" a quem pediu', async () => {
    await usar('abrir_chamado', { setor_id: await setorId('Fiscal'), titulo: 'Guia do DAS', resumo: 'Pediu a guia.', fora_do_contrato: false, prioridade: 'normal' });
    await pedirValorDaGuia();
    estado.recusou = false; // outro turno
    const r = await usar('consultar_chamados', {});
    expect(r.chamados.map((c: { titulo: string }) => c.titulo)).toEqual(['Guia do DAS']);
  });
});

describe('dentro do acesso e casos que sempre abrem', () => {
  it('Fiscal: demanda normal, sem recusa', async () => {
    const r = await usar('abrir_chamado', { setor_id: await setorId('Fiscal'), titulo: 'Guia do DAS', resumo: 'Pediu a guia.', fora_do_contrato: false, prioridade: 'normal' });
    expect(r.setor).toBe('Fiscal');
    expect(paraCarla()).toEqual([]);
  });
  it('valores no Fiscal sem "Ver valores": recusa e aviso falando de valores (D12)', async () => {
    await usar('abrir_chamado', { setor_id: await setorId('Fiscal'), titulo: 'Valor da guia', resumo: 'Quanto ficou a folha?', fora_do_contrato: false, prioridade: 'normal', pede_valores: true });
    expect(paraCarla()).toEqual([TEXTO_FORA_DO_ACESSO]);
    expect(paraRoberto()[0]).toContain('valores (honorários, boletos ou salários)');
  });
  it('Triagem continua aberta (nada revelado)', async () => {
    const r = await usar('abrir_chamado', { setor_id: 'triagem', titulo: 'Falar com alguém', resumo: 'Quer falar com alguém.', fora_do_contrato: false, prioridade: 'normal' });
    expect(r.setor).toBe('Triagem');
    expect(paraCarla()).toEqual([]);
  });
  it('a demanda de quem não vê valores avisa a equipe', async () => {
    await usar('abrir_chamado', { setor_id: await setorId('Fiscal'), titulo: 'Guia do DAS', resumo: 'Pediu a guia.', fora_do_contrato: false, prioridade: 'normal' });
    const { data } = await db.from('chamados').select('resumo').eq('cliente_id', rede).single();
    expect(data!.resumo).toBe('Pediu a guia.\n\nEste contato não tem "Ver valores": não informe honorários, boletos nem salários a ele.');
  });
});

describe('Básico nunca dispara recusa nem aviso (D16)', () => {
  beforeEach(async () => { await definirAcessoTeste(carla, rede, { perfil: 'basico', podePedirNota: true }); });
  it('folha com valores: demanda normal no Pessoal, com a observação do Básico', async () => {
    const r = await pedirFolha();
    expect(r.setor).toBe('Pessoal');
    expect(canal.enviados).toEqual([]);
    const { data } = await db.from('chamados').select('titulo, resumo').eq('cliente_id', rede).single();
    expect(data!.titulo).toBe('Folha de setembro');
    expect(data!.resumo).toContain('Contato com acesso ainda não definido (Básico)');
    expect((await db.from('pedidos_fora_do_acesso').select('id')).data).toEqual([]);
  });
  it('com "Pode pedir nota": buscar_produtos e resumir_pedido_nota funcionam', async () => {
    const cad = await criarCadastrosExemplo(rede);
    const b = await usar('buscar_produtos', { textos: ['costela'] });
    expect(b.instrucao).toBeUndefined();
    expect(b.resultados[0].candidatos[0].id).toBe(cad.costela);
    const r = await usar('resumir_pedido_nota', {
      tipo: 'venda', unidade_id: cad.brasilEfigenia, texto_destinatario: 'Brasil Santa Efigênia',
      itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 20, unidade: 'PAC' }],
    });
    expect(r).toMatchObject({ enviado: true });
    expect(paraCarla()).toHaveLength(1);
    expect(paraCarla()[0]).toContain('Costela com Requeijão');
  });
});

describe('abrir_pedido_nota usa o acesso de agora', () => {
  it('"Pode pedir nota" tirado depois de carregar a conversa (Fiscal marcado): a demanda leva as observações de hoje', async () => {
    const cad = await criarCadastrosExemplo(rede);
    await definirAcessoTeste(carla, rede, { perfil: 'personalizado', setores: ['Fiscal'], podePedirNota: false });
    expect(estado.ctx.empresaEmFoco!.podePedirNota).toBe(true); // o contexto ainda tem o de antes
    const base = {
      tipo: 'venda', unidade_id: cad.brasilEfigenia, texto_destinatario: 'Brasil Santa Efigênia',
      itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 20, unidade: 'PAC' }],
    };
    await usar('resumir_pedido_nota', base);
    const r = await usar('abrir_pedido_nota', { ...base, pedido_original: 'NF pro Brasil: 20 costela', cliente_confirmou_resumo: true, prioridade: 'normal' });
    expect(r.setor).toBe('Fiscal');
    const { data } = await db.from('chamados').select('resumo').eq('cliente_id', rede).single();
    expect(data!.resumo).toContain('Observação: contato sem permissão para pedir nota.');
    expect(data!.resumo).toContain('Este contato não tem "Ver valores": não informe honorários, boletos nem salários a ele.');
  });
});

describe('dia de São Paulo', () => {
  it('23h30 de São Paulo ainda é o mesmo dia', () => {
    expect(diaEmSaoPaulo(new Date('2026-10-14T02:30:00Z'))).toBe('2026-10-13');
    expect(diaEmSaoPaulo(new Date('2026-10-14T03:30:00Z'))).toBe('2026-10-14');
  });
});

describe('título sem valores', () => {
  it('mascara reais com e sem "R$", "N mil" e "N reais"; o assunto fica', () => {
    expect(tituloSemValores('Folha de setembro R$ 12.345,67')).toBe('Folha de setembro R$ …');
    expect(tituloSemValores('Boleto de 12.345,67 em aberto')).toBe('Boleto de … em aberto');
    expect(tituloSemValores('Honorário 850,00')).toBe('Honorário …');
    expect(tituloSemValores('Acordo de 15 mil')).toBe('Acordo de …');
    expect(tituloSemValores('Multa de 300 reais')).toBe('Multa de …');
    expect(tituloSemValores('Rescisão de 2,5 mil reais')).toBe('Rescisão de …');
    expect(tituloSemValores('Guia do DAS de 09/2026')).toBe('Guia do DAS de 09/2026');
    expect(tituloSemValores('NF 1234 de 20 PAC')).toBe('NF 1234 de 20 PAC');
  });
});
