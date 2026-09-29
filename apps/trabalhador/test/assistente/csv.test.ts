import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContextoAssistente } from '../../src/assistente/contexto';
import { executarFerramentaAssistente, type EstadoAssistente } from '../../src/assistente/ferramentas';
import { processarAssistente } from '../../src/assistente/processar';
import { montarPedidoVenda } from '../../src/agente/pedido-nota';
import { CanalFalso } from '../../src/canal/falso';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { criarUsuarioTeste } from '../apoio/usuario';

let canal: CanalFalso;
let dono: string;
let numero: number;
let chamadoId: string;
let clienteId: string;
let efigenia: Awaited<ReturnType<typeof repos.unidadesDaEmpresa>>[number];
let costela: Awaited<ReturnType<typeof repos.produtosDaEmpresa>>[number];

const abrirVenda = async (setor: string, titulo: string) => {
  const c = await repos.abrirChamado({ clienteId, conversaId: null, setorId: await setorId(setor), responsavelId: null,
    titulo, resumo: 'r', foraDoContrato: false, origem: 'agente' });
  await repos.anexarPedidoVenda(c.id, montarPedidoVenda({ agora: new Date('2026-09-29T15:00:00Z'), destino: efigenia, textoDestinatario: 'Brasil',
    itens: [{ produto: costela, texto: 'costela', quantidade: 10, unidade: 'PAC', preco: 9.5 }], extras: {} }));
  return c;
};

beforeEach(async () => {
  await limparBanco();
  await db.from('auditoria_acessos').delete().eq('entidade', 'csv_bling'); // limparBanco não zera a auditoria
  canal = new CanalFalso();
  dono = await criarUsuarioTeste({ email: 'dono@teste-csv.local', permissoes: ['assistente_site', 'assistente_whatsapp'], telefone: '5531988887777' });
  const { empresas } = await contatoComEmpresas(['Indústria X']);
  clienteId = empresas[0]!.id;
  const cad = await criarCadastrosExemplo(clienteId);
  efigenia = (await repos.unidadesDaEmpresa(clienteId, 'cliente')).find((u) => u.id === cad.brasilEfigenia)!;
  costela = (await repos.produtosDaEmpresa(clienteId)).find((p) => p.id === cad.costela)!;
  ({ id: chamadoId, numero } = await abrirVenda('Fiscal', 'NF de venda – Brasil'));
});

const rodar = async (canalAssistente: 'site' | 'whatsapp', roteiro: ConstructorParameters<typeof IaRoteirizada>[0]) => {
  await repos.registrarMensagemAssistente({ usuarioId: dono, canal: canalAssistente, conversaId: null, papel: 'usuario', conteudo: `gera o CSV do pedido ${numero}` });
  const ia = new IaRoteirizada(roteiro);
  await processarAssistente({ repos, ia, canal }, { usuarioId: dono, canal: canalAssistente, conversaId: null, telefone: canalAssistente === 'whatsapp' ? '553188887777' : null }, true);
  return ia;
};

const estadoDe = async (usuarioId: string, canalAssistente: 'site' | 'whatsapp'): Promise<EstadoAssistente> => {
  const u = (await repos.obterUsuarioAssistente(usuarioId))!;
  return { ctx: await carregarContextoAssistente(repos, u, canalAssistente, null, new Date('2026-09-29T15:00:00Z')), resposta: [], arquivo: null, csvs: [], previas: new Set(), acoes: [] };
};

describe('gerar_csv_bling pelo assistente (pedido do dono, 2026-09-29)', () => {
  it('site: a resposta leva o arquivo para baixar no painel', async () => {
    await rodar('site', [usarFerramentas({ nome: 'gerar_csv_bling', entrada: { numeros: [numero] } }), usarFerramentas({ nome: 'responder', entrada: { texto: 'Pronto!' } }), fim()]);
    const ultima = (await repos.historicoAssistente(dono, 'site', null, 5)).at(-1)!;
    expect(ultima.arquivo).toMatchObject({ tipo: 'csv_bling', chamados: [chamadoId], partes: 1 });
    expect((ultima.arquivo as { nome: string }).nome).toMatch(/^pedidos_venda_bling_\d{8}_\d{4}\.csv$/);
    expect(canal.enviados).toEqual([]);
  });

  it('WhatsApp: manda o texto e o CSV como documento', async () => {
    await rodar('whatsapp', [usarFerramentas({ nome: 'gerar_csv_bling', entrada: { numeros: [numero] } }), usarFerramentas({ nome: 'responder', entrada: { texto: 'Segue o arquivo.' } }), fim()]);
    expect(canal.enviados[0]).toEqual({ telefone: '553188887777', texto: 'Segue o arquivo.' });
    expect(canal.arquivosEnviados).toHaveLength(1);
    const csv = Buffer.from(canal.arquivosEnviados[0]!.url.replace('data:text/csv;base64,', ''), 'base64').toString('utf8');
    expect(csv.split('\n')[1]).toContain(`${numero},Supermercado Brasil Ltda`);
    const { data: aud } = await db.from('auditoria_acessos').select('acao, detalhes').eq('entidade', 'csv_bling');
    expect(aud).toMatchObject([{ acao: 'download', detalhes: { canal: 'whatsapp', pedidos: [numero] } }]);
  });

  it('com pendência não gera e devolve a lista para explicar', async () => {
    await db.from('chamados').update({ pedido_venda: { ...(await db.from('chamados').select('pedido_venda').eq('id', chamadoId).single()).data!.pedido_venda as object,
      itens: [{ produto: 'Costela', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: null }] } }).eq('id', chamadoId);
    const ia = await rodar('site', [usarFerramentas({ nome: 'gerar_csv_bling', entrada: { numeros: [numero] } }), usarFerramentas({ nome: 'responder', entrada: { texto: 'Falta preço.' } }), fim()]);
    expect(ia.recebidos[1]!.messages.at(-1)!.content).toEqual([expect.objectContaining({ is_error: true, content: expect.stringContaining('falta Valor Unitário') })]);
    expect((await repos.historicoAssistente(dono, 'site', null, 5)).at(-1)!.arquivo).toBeNull();
  });

  it('atendente com abertas = true só recebe os pedidos do setor dele', async () => {
    const outro = await abrirVenda('Pessoal', 'NF de venda – outro setor');
    const ana = await criarUsuarioTeste({ email: 'ana@teste-csv.local', papel: 'atendente', permissoes: ['emitir_notas'], setores: ['Fiscal'] });
    const estado = await estadoDe(ana, 'whatsapp');
    const r = await executarFerramentaAssistente({ repos, ia: new IaRoteirizada([]), canal }, estado, 'gerar_csv_bling', { abertas: true });
    expect(r.erro).toBe(false);
    expect(JSON.parse(r.resultado)).toMatchObject({ pedidos: 1 });
    expect(estado.csvs).toHaveLength(1);
    const linhas = estado.csvs[0]!.conteudo.split('\n').slice(1).filter(Boolean);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toContain(`${numero},Supermercado Brasil Ltda`);
    expect(estado.csvs[0]!.conteudo).not.toContain(`${outro.numero},Supermercado Brasil Ltda`);
  });

  it('números repetidos e inexistentes: um pedido no arquivo, incluídos e ignorados informados', async () => {
    const e = await estadoDe(dono, 'site');
    const r = await executarFerramentaAssistente({ repos, ia: new IaRoteirizada([]), canal }, e, 'gerar_csv_bling', { numeros: [numero, numero, 99999] });
    const saida = JSON.parse(r.resultado);
    expect(r.erro).toBe(false);
    expect(saida).toMatchObject({ pedidos: 1, incluidos: [numero], ignorados: [99999],
      motivo_ignorados: 'não encontradas, sem pedido de venda ou fora das que você pode ver' });
    expect(saida.instrucao).toContain('ignorados');
    expect(e.arquivo).toMatchObject({ chamados: [chamadoId], partes: 1 });
  });

  it('pedidosVendaParaBling atravessa blocos de 100 ids, em ordem de número', async () => {
    const outros = [];
    for (let i = 0; i < 104; i++) outros.push((await abrirVenda('Fiscal', `NF ${i}`)).id);
    const falsos = Array.from({ length: 45 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const ids = [...falsos.slice(0, 20), chamadoId, ...falsos.slice(20), ...outros];
    const pedidos = await repos.pedidosVendaParaBling(ids);
    expect(pedidos).toHaveLength(105);
    const numeros = pedidos.map((p) => p.numero);
    expect(numeros).toEqual([...numeros].sort((a, b) => a - b));
    expect(numeros).toContain(numero);
    expect((await repos.pedidosVendaParaBling([...falsos, chamadoId])).map((p) => p.numero)).toEqual([numero]);
  }, 120000);

  it('entrada sem números nem abertas, ou com número inválido, vira erro da ferramenta', async () => {
    const e = await estadoDe(dono, 'site');
    const d = { repos, ia: new IaRoteirizada([]), canal };
    expect((await executarFerramentaAssistente(d, e, 'gerar_csv_bling', {})).erro).toBe(true);
    expect((await executarFerramentaAssistente(d, e, 'gerar_csv_bling', { numeros: [0] })).erro).toBe(true);
    expect((await executarFerramentaAssistente(d, e, 'gerar_csv_bling', { numeros: [1.5] })).erro).toBe(true);
  });
});
