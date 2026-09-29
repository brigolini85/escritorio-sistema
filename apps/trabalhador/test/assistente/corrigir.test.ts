import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContextoAssistente } from '../../src/assistente/contexto';
import { executarFerramentaAssistente, type EstadoAssistente } from '../../src/assistente/ferramentas';
import { montarPedidoNota, montarPedidoVenda } from '../../src/agente/pedido-nota';
import { CanalFalso } from '../../src/canal/falso';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId, type CadastrosExemplo } from '../apoio/cenario';
import { IaRoteirizada, fimVazio, textoSolto, usarFerramentas } from '../apoio/ia-roteirizada';
import { executarAssistente } from '../../src/assistente/executar';
import { criarUsuarioTeste } from '../apoio/usuario';

let cad: CadastrosExemplo;
let pedido: { id: string; numero: number };

async function estadoDe(usuarioId: string): Promise<EstadoAssistente> {
  const u = (await repos.obterUsuarioAssistente(usuarioId))!;
  return { ctx: await carregarContextoAssistente(repos, u, 'site', null, new Date('2026-09-29T15:00:00Z')), resposta: [], arquivo: null, csvs: [], previas: new Set(), acoes: [] };
}
const usar = async (estado: EstadoAssistente, entrada: object) => {
  const r = await executarFerramentaAssistente({ repos, ia: new IaRoteirizada([]), canal: new CanalFalso() }, estado, 'alterar_pedido_venda', entrada);
  return { ...JSON.parse(r.resultado), _erro: r.erro };
};
const previa = async (usuarioId: string, entrada: object) => { const r = await usar(await estadoDe(usuarioId), entrada); expect(r._erro).toBe(false); return r; };
const confirmar = async (usuarioId: string, entrada: object) => { await previa(usuarioId, { ...entrada, confirmado: false }); return usar(await estadoDe(usuarioId), { ...entrada, confirmado: true }); };
const itens15 = () => [{ produto_id: cad.costela, texto: 'costela', quantidade: 15, unidade: 'PAC' }];
const salvo = async () => (await db.from('chamados').select('pedido_venda, resumo, status').eq('id', pedido.id).single()).data!;

beforeEach(async () => {
  await limparBanco();
  const { empresas } = await contatoComEmpresas(['Indústria X']);
  cad = await criarCadastrosExemplo(empresas[0]!.id);
  const efigenia = (await repos.unidadesDaEmpresa(empresas[0]!.id, 'cliente')).find((u) => u.id === cad.brasilEfigenia)!;
  const costela = (await repos.produtosDaEmpresa(empresas[0]!.id)).find((p) => p.id === cad.costela)!;
  const itens = [{ produto: costela, texto: 'costela', quantidade: 10, unidade: 'PAC', preco: 9.5 }];
  const { titulo, resumo } = montarPedidoNota({ tipo: 'venda', destino: efigenia, textoDestinatario: 'Brasil', itens, pedidoOriginal: '10 costela', semPermissao: false });
  pedido = await repos.abrirChamado({ clienteId: empresas[0]!.id, conversaId: null, setorId: await setorId('Fiscal'), responsavelId: null, titulo, resumo, foraDoContrato: false, origem: 'agente' });
  await repos.anexarPedidoVenda(pedido.id, montarPedidoVenda({ agora: new Date('2026-09-29T15:00:00Z'), destino: efigenia, textoDestinatario: 'Brasil', itens, extras: {} }));
});

describe('alterar_pedido_venda (pedido do dono, 2026-09-29)', () => {
  it('sem confirmação mostra antes e depois e não grava', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' }));
    const r = await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: false });
    expect(r).toMatchObject({ _erro: false, gravado: false,
      antes: 'Destinatário: Supermercado Brasil / Santa Efigênia\n• 10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00\nTotal: R$ 95,00',
      depois: 'Destinatário: Supermercado Brasil / Santa Efigênia\n• 15 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 142,50\nTotal: R$ 142,50' });
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('com confirmação grava o pedido, refaz o resumo, anota na demanda e na auditoria', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local', nome: 'Thiago' });
    const r = await confirmar(dono, { numero: pedido.numero, itens: itens15() });
    expect(r).toMatchObject({ _erro: false, gravado: true });
    const s = await salvo();
    expect(s.pedido_venda).toMatchObject({ data: '29/09/2026', itens: [{ quantidade: 15, valor_unitario: 9.5 }] });
    expect(s.resumo).toContain('15 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 142,50');
    expect(s.resumo).toContain('Pedido original: "10 costela"');
    const { data: ev } = await db.from('chamado_eventos').select('tipo, texto, usuario_id').eq('chamado_id', pedido.id).eq('tipo', 'nota_interna').single();
    expect(ev).toMatchObject({ usuario_id: dono });
    expect(ev!.texto).toContain('Pedido alterado pelo assistente a pedido de Thiago');
    const { data: aud } = await db.from('auditoria_acessos').select('acao').eq('entidade', 'pedido_venda').eq('entidade_id', pedido.id);
    expect(aud).toEqual([{ acao: 'assistente' }]);
  });

  it('sem a permissão de corrigir pedidos, recusa', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'ana@teste-corrigir.local', papel: 'atendente', setores: ['Fiscal'] }));
    expect(JSON.stringify(await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: false }))).toContain('permissão');
  });

  it('atendente de outro setor não corrige, mesmo com a permissão', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'ana@teste-corrigir.local', papel: 'atendente', permissoes: ['emitir_notas'], setores: ['Pessoal'] }));
    expect((await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: true }))._erro).toBe(true);
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('demanda concluída não muda', async () => {
    await db.from('chamados').update({ status: 'concluido' }).eq('id', pedido.id);
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' }));
    expect(JSON.stringify(await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: false }))).toContain('concluída');
  });

  it('produto de outra empresa é recusado', async () => {
    const { data: y } = await db.from('clientes').insert({ razao_social: 'Indústria Y', cnpj: '99888777000166' }).select().single();
    const { data: alheio } = await db.from('produtos').insert({ cliente_id: y!.id, codigo: '1', descricao: 'Alheio' }).select().single();
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' }));
    expect((await usar(e, { numero: pedido.numero, itens: [{ produto_id: alheio!.id, texto: 'x', quantidade: 1, unidade: 'UN' }], confirmado: false }))._erro).toBe(true);
  });
  it('confirmar duas vezes o mesmo pedido grava uma vez só (reexecução do laço)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local', nome: 'Thiago' });
    await confirmar(dono, { numero: pedido.numero, itens: itens15() });
    const r = await confirmar(dono, { numero: pedido.numero, itens: itens15() });
    expect(r).toMatchObject({ _erro: false, gravado: true, ja_estava: true });
    const { data: ev } = await db.from('chamado_eventos').select('id').eq('chamado_id', pedido.id).eq('tipo', 'nota_interna');
    expect(ev).toHaveLength(1);
    const { data: aud } = await db.from('auditoria_acessos').select('id').eq('entidade', 'pedido_venda').eq('entidade_id', pedido.id);
    expect(aud).toHaveLength(1);
  });
  it('a confirmação é exigida no código: sem prévia, recusa', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const r = await usar(await estadoDe(dono), { numero: pedido.numero, itens: itens15(), confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('Não achei a prévia');
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('prévia e confirmação na mesma execução: recusa', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' }));
    await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const r = await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('próxima mensagem');
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('a confirmação grava a prévia guardada, mesmo que o modelo mande outros dados (99 em vez de 15)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const r = await usar(await estadoDe(dono), { numero: pedido.numero, itens: [{ ...itens15()[0]!, quantidade: 99 }], confirmado: true });
    expect(r).toMatchObject({ _erro: false, gravado: true });
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 15, valor_unitario: 9.5 }] });
  });

  it('a confirmação só com numero e confirmado grava a prévia (produto e preço da prévia)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const e = await estadoDe(dono);
    const r = await usar(e, { numero: pedido.numero, confirmado: true });
    expect(r).toMatchObject({ _erro: false, gravado: true });
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 15, valor_unitario: 9.5 }] });
    expect(e.acoes).toEqual([`pedido #${pedido.numero} alterado`]);
  });

  it('preço da tabela mudou entre a prévia e a confirmação: recusa', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    await db.from('precos').update({ valor: 10 }).eq('produto_id', cad.costela);
    const r = await usar(await estadoDe(dono), { numero: pedido.numero, confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('mudaram desde a prévia');
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('a prévia de outra pessoa não vale', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const outro = await criarUsuarioTeste({ email: 'outro@teste-corrigir.local', nome: 'Outro' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const r = await usar(await estadoDe(outro), { numero: pedido.numero, itens: itens15(), confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('Não achei a prévia');
  });

  it('observações, transportadora e tipo de frete aparecem no antes e depois', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    for (const extra of [{ observacoes: 'Entregar pela manhã' }, { transportadora: 'Rápido Ltda' }, { tipo_frete: 'D' }]) {
      const r = await previa(dono, { numero: pedido.numero, ...extra, confirmado: false });
      expect(r.depois).not.toBe(r.antes);
    }
    const r = await previa(dono, { numero: pedido.numero, tipo_frete: 'D', transportadora: 'Rápido Ltda', observacoes: 'Manhã', confirmado: false });
    expect(r.depois).toContain('Tipo de frete: por conta do destinatário');
    expect(r.depois).toContain('Transportadora: Rápido Ltda');
    expect(r.depois).toContain('Observações: Manhã');
  });

  it('trocar o destinatário exige os itens de novo', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const r = await usar(await estadoDe(dono), { numero: pedido.numero, unidade_id: cad.brasilMatilde, confirmado: false });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('mande os itens de novo');
  });

  it('trocar o destinatário com os itens atualiza o pedido, o texto e o título da demanda', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const r = await previa(dono, { numero: pedido.numero, unidade_id: cad.brasilMatilde, itens: itens15(), confirmado: false });
    expect(r.depois).toContain('Destinatário: Supermercado Brasil / Santa Matilde');
    expect(r.antes).toContain('Destinatário: Supermercado Brasil / Santa Efigênia');
    await confirmar(dono, { numero: pedido.numero, unidade_id: cad.brasilMatilde, itens: itens15() });
    const { data: c } = await db.from('chamados').select('titulo, pedido_venda').eq('id', pedido.id).single();
    expect(c!.titulo).toContain('Supermercado Brasil / Santa Matilde');
    expect(c!.pedido_venda).toMatchObject({ unidade_id: cad.brasilMatilde, texto_destinatario: 'Supermercado Brasil / Santa Matilde' });
  });

  it('preço informado em outra unidade: resumo e pedido em KG, e não muda numa correção sem itens', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const itensKg = [{ produto_id: cad.costela, texto: 'costela', quantidade: 3, unidade: 'kg', valor_unitario: 30 }];
    await confirmar(dono, { numero: pedido.numero, itens: itensKg });
    const a = await salvo();
    expect(a.pedido_venda).toMatchObject({ itens: [{ un: 'KG', quantidade: 3, valor_unitario: 30 }] });
    expect(a.resumo).toContain('3 KG Costela com Requeijão (cód. 12) × R$ 30,00 = R$ 90,00 (preço informado)');
    await confirmar(dono, { numero: pedido.numero, observacoes: 'Manhã' });
    const b = await salvo();
    expect(b.resumo).toBe(a.resumo);
    expect(b.pedido_venda).toMatchObject({ itens: [{ un: 'KG', valor_unitario: 30 }], observacoes: 'Manhã' });
  });

  it('ver_demanda devolve cliente_id e o produto_id de cada item', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const r = await executarFerramentaAssistente({ repos, ia: new IaRoteirizada([]), canal: new CanalFalso() }, await estadoDe(dono), 'ver_demanda', { numero: pedido.numero });
    const j = JSON.parse(r.resultado);
    expect(j.cliente_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(j.pedido.itens_produto_id).toEqual([{ codigo: '12', produto_id: cad.costela }]);
  });
});

describe('resposta final verdadeira (pedido do dono, 2026-09-29)', () => {
  const rodar = async (dono: string, roteiro: ConstructorParameters<typeof IaRoteirizada>[0]) => {
    await repos.registrarMensagemAssistente({ usuarioId: dono, canal: 'site', conversaId: null, papel: 'usuario', conteudo: 'sim, pode gravar' });
    const e = await estadoDe(dono);
    const historico = await repos.historicoAssistente(dono, 'site', null, 30);
    return executarAssistente({ repos, ia: new IaRoteirizada(roteiro), canal: new CanalFalso() }, e.ctx, historico);
  };

  it('o laço termina em texto solto: esse texto é a resposta', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const e = await rodar(dono, [textoSolto('ok, gravei'), textoSolto('ok, gravei')]);
    expect(e.resposta).toEqual(['ok, gravei']);
  });

  it('gravou e o modelo termina vazio duas vezes: responde "Feito: pedido #N alterado"', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const e = await rodar(dono, [usarFerramentas({ nome: 'alterar_pedido_venda', entrada: { numero: pedido.numero, confirmado: true } }), fimVazio(), fimVazio()]);
    expect(e.resposta).toEqual([`Feito: pedido #${pedido.numero} alterado.`]);
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 15 }] });
  });
});
