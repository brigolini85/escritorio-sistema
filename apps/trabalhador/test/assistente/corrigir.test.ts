import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContextoAssistente } from '../../src/assistente/contexto';
import { executarFerramentaAssistente, novoEstado, type EstadoAssistente } from '../../src/assistente/ferramentas';
import { montarPedidoNota, montarPedidoVenda } from '../../src/agente/pedido-nota';
import { CanalFalso } from '../../src/canal/falso';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId, type CadastrosExemplo } from '../apoio/cenario';
import { IaRoteirizada, IaValidadora, cortado, fim, fimVazio, textoEFerramenta, textoSolto, usarFerramentas } from '../apoio/ia-roteirizada';
import { MENSAGEM_VAZIA, executarAssistente } from '../../src/assistente/executar';
import { criarUsuarioTeste } from '../apoio/usuario';

let cad: CadastrosExemplo;
let pedido: { id: string; numero: number };

async function estadoDe(usuarioId: string, conversaId: string | null = null): Promise<EstadoAssistente> {
  const u = (await repos.obterUsuarioAssistente(usuarioId))!;
  return novoEstado(await carregarContextoAssistente(repos, u, 'site', conversaId, new Date('2026-09-29T15:00:00Z')));
}
/** Execução seguinte, disparada pelo "sim" da pessoa (a pergunta é gravada agora, depois da prévia). */
async function estadoDoSim(usuarioId: string, conversaId: string | null = null): Promise<EstadoAssistente> {
  const e = await estadoDe(usuarioId, conversaId);
  const id = await repos.registrarMensagemAssistente({ usuarioId, canal: 'site', conversaId, papel: 'usuario', conteudo: 'sim, pode gravar' });
  e.ctx.perguntaMaisRecenteEm = new Date((await db.from('assistente_mensagens').select('criado_em').eq('id', id).single()).data!.criado_em);
  return e;
}
const usar = async (estado: EstadoAssistente, entrada: object) => {
  const r = await executarFerramentaAssistente({ repos, ia: new IaRoteirizada([]), canal: new CanalFalso() }, estado, 'alterar_pedido_venda', entrada);
  return { ...JSON.parse(r.resultado), _erro: r.erro };
};
const previa = async (usuarioId: string, entrada: object) => { const r = await usar(await estadoDe(usuarioId), entrada); expect(r._erro).toBe(false); return r; };
const confirmar = async (usuarioId: string, entrada: { numero: number } & Record<string, unknown>) => {
  await previa(usuarioId, { ...entrada, confirmado: false });
  return usar(await estadoDoSim(usuarioId), { numero: entrada.numero, confirmado: true });
};
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
  it('confirmar duas vezes o mesmo pedido grava uma vez só (nova prévia do pedido já corrigido)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local', nome: 'Thiago' });
    await confirmar(dono, { numero: pedido.numero, itens: itens15() });
    const r = await confirmar(dono, { numero: pedido.numero, itens: itens15() });
    expect(r).toMatchObject({ _erro: false, gravado: true, ja_estava: true });
    const { data: ev } = await db.from('chamado_eventos').select('id').eq('chamado_id', pedido.id).eq('tipo', 'nota_interna');
    expect(ev).toHaveLength(1);
    const { data: aud } = await db.from('auditoria_acessos').select('id').eq('entidade', 'pedido_venda').eq('entidade_id', pedido.id);
    expect(aud).toHaveLength(1);
  });

  it('a gravação consome a prévia: outro "sim" sem nova prévia é recusado (revisão final, A1)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    expect(await confirmar(dono, { numero: pedido.numero, itens: itens15() })).toMatchObject({ _erro: false, gravado: true });
    const r = await usar(await estadoDoSim(dono), { numero: pedido.numero, confirmado: true });
    expect(r).toMatchObject({ _erro: true, erro: 'Mostre o antes e o depois de novo e espere a confirmação.' });
  });

  it('uma chamada que falhou depois da prévia a consome (revisão final, A1)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    // Chamada com destinatário de fora: falha e fica registrada como a última deste pedido.
    expect((await usar(await estadoDe(dono), { numero: pedido.numero, unidade_id: cad.boiBom, itens: itens15(), confirmado: false }))._erro).toBe(true);
    const r = await usar(await estadoDoSim(dono), { numero: pedido.numero, confirmado: true });
    expect(r).toMatchObject({ _erro: true, erro: 'Mostre o antes e o depois de novo e espere a confirmação.' });
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('a prévia só vale na conversa em que foi mostrada (revisão final, A2)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const conversa = await repos.obterOuCriarConversa('5531999990009', null);
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });   // no /assistente (sem conversa)
    const r = await usar(await estadoDoSim(dono, conversa.id), { numero: pedido.numero, confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('outra conversa');
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('o "sim" tem de chegar depois da prévia (revisão final, A3)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const e = await estadoDoSim(dono);   // a pergunta mais nova é anterior à prévia
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const r = await usar(e, { numero: pedido.numero, confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('próxima mensagem');
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('pedido alterado por outra pessoa entre a prévia e o "sim": recusa (revisão final, A4)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, observacoes: 'Manhã', confirmado: false });
    const atual = (await salvo()).pedido_venda as object;
    // Só o "antes" muda: o "depois" (observações = Manhã) seria igual ao da prévia.
    await db.from('chamados').update({ pedido_venda: { ...atual, observacoes: 'Tarde' } }).eq('id', pedido.id);
    const r = await usar(await estadoDoSim(dono), { numero: pedido.numero, confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('O pedido mudou desde a prévia');
    expect((await salvo()).pedido_venda).toMatchObject({ observacoes: 'Tarde' });
  });

  it('a confirmação é exigida no código: sem prévia, recusa', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const r = await usar(await estadoDoSim(dono), { numero: pedido.numero, confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('Não achei a prévia');
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('prévia e confirmação na mesma execução: recusa', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const e = await estadoDe(dono);
    await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const r = await usar(e, { numero: pedido.numero, confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('próxima mensagem');
    // Mesmo com uma pergunta posterior no contexto, a prévia desta execução não vale como confirmação.
    e.ctx.perguntaMaisRecenteEm = new Date(Date.now() + 60_000);
    expect((await usar(e, { numero: pedido.numero, confirmado: true })).erro).toContain('Mostre o antes e o depois de novo');
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('confirmação com outros dados (99 em vez de 15) é recusada, sem gravar (revisão final, A5)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const r = await usar(await estadoDoSim(dono), { numero: pedido.numero, itens: [{ ...itens15()[0]!, quantidade: 99 }], confirmado: true });
    expect(r).toMatchObject({ _erro: true, erro: 'Para mudar mais alguma coisa, faça uma nova prévia.' });
    expect(await usar(await estadoDoSim(dono), { numero: pedido.numero, confirmado: true, quantidade: 99 })).toMatchObject({ _erro: true, erro: 'Para mudar mais alguma coisa, faça uma nova prévia.' });
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  it('a confirmação só com numero e confirmado grava a prévia (produto e preço da prévia)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const e = await estadoDoSim(dono);
    const r = await usar(e, { numero: pedido.numero, confirmado: true });
    expect(r).toMatchObject({ _erro: false, gravado: true });
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 15, valor_unitario: 9.5 }] });
    expect(e.acoes).toEqual([`pedido #${pedido.numero} alterado`]);
  });

  it('preço da tabela mudou entre a prévia e a confirmação: recusa', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    await db.from('precos').update({ valor: 10 }).eq('produto_id', cad.costela);
    const r = await usar(await estadoDoSim(dono), { numero: pedido.numero, confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('mudou desde a prévia');
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });

  describe('o "sim" refaz a prévia antes de confirmar (Claude de verdade, 2026-09-29)', () => {
    const NUDGE = 'Essa mesma prévia já foi mostrada antes da última mensagem da pessoa. Se ela confirmou, chame agora alterar_pedido_venda só com numero e confirmado = true.';
    const csv = async (e: EstadoAssistente) => {
      const r = await executarFerramentaAssistente({ repos, ia: new IaRoteirizada([]), canal: new CanalFalso() }, e, 'gerar_csv_bling', { numeros: [pedido.numero] });
      return { ...JSON.parse(r.resultado), _erro: r.erro };
    };

    it('prévias refeitas no job do "sim" (outra, com erro e igual) não tomam o lugar da prévia mostrada: grava a mostrada', async () => {
      const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
      await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });   // P1, mostrada à pessoa
      const e = await estadoDoSim(dono);
      const p2 = await usar(e, { numero: pedido.numero, itens: [{ produto_id: null, texto: 'costela', quantidade: 15, unidade: 'PAC' }], confirmado: false });
      expect(p2._erro).toBe(false);
      expect(p2.instrucao).not.toBe(NUDGE);   // prévia diferente da mostrada: sem o empurrão
      expect((await usar(e, { numero: pedido.numero, unidade_id: cad.boiBom, itens: itens15(), confirmado: false }))._erro).toBe(true);
      const p3 = await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: false });   // igual a P1
      expect(p3).toMatchObject({ _erro: false, gravado: false, instrucao: NUDGE });
      const r = await usar(e, { numero: pedido.numero, confirmado: true });
      expect(r).toMatchObject({ _erro: false, gravado: true });
      expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 15, valor_unitario: 9.5 }] });
      expect(e.acoes).toEqual([`pedido #${pedido.numero} alterado`]);
      // Gravado: o CSV deste job não é mais recusado por prévia sem gravar.
      expect((await csv(e)).erro ?? '').not.toContain('Grave a correção');
    });

    it('"sim, mas muda pra 20": nova prévia diferente no job e confirmação é recusada; no "sim" seguinte grava 20', async () => {
      const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
      await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });   // P1 (15), mostrada
      const e = await estadoDoSim(dono);
      const itens20 = [{ ...itens15()[0]!, quantidade: 20 }];
      expect(await usar(e, { numero: pedido.numero, itens: itens20, confirmado: false })).toMatchObject({ _erro: false, gravado: false });
      expect(await usar(e, { numero: pedido.numero, confirmado: true })).toMatchObject({ _erro: true,
        erro: 'A pessoa pediu uma mudança diferente da prévia aprovada. Mostre a nova prévia e espere a confirmação na próxima mensagem.' });
      expect(await csv(e)).toMatchObject({ _erro: true, erro: `Grave a correção do pedido #${pedido.numero} antes de gerar o CSV.` });
      expect(e.arquivo).toBeNull();
      expect(e.acoes).toEqual([]);
      expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
      // A pessoa viu a prévia de 20 e diz "sim" na mensagem seguinte: grava 20.
      const e3 = await estadoDoSim(dono);
      expect(await usar(e3, { numero: pedido.numero, confirmado: true })).toMatchObject({ _erro: false, gravado: true });
      expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 20 }] });
      expect(e3.acoes).toEqual([`pedido #${pedido.numero} alterado`]);
    });

    it('no job do "sim", CSV pedido antes de confirmar continua recusado (B)', async () => {
      const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
      await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
      const e = await estadoDoSim(dono);
      await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: false });
      expect(await csv(e)).toMatchObject({ _erro: true, erro: `Grave a correção do pedido #${pedido.numero} antes de gerar o CSV.` });
      expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
    });

    it('depois de gravado, um novo "sim" com prévia refeita não grava de novo', async () => {
      const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
      expect(await confirmar(dono, { numero: pedido.numero, itens: itens15() })).toMatchObject({ _erro: false, gravado: true });
      const e = await estadoDoSim(dono);
      await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: false });
      expect(await usar(e, { numero: pedido.numero, confirmado: true })).toMatchObject({ _erro: true, erro: 'Mostre o antes e o depois de novo e espere a confirmação.' });
      const { data: ev } = await db.from('chamado_eventos').select('id').eq('chamado_id', pedido.id).eq('tipo', 'nota_interna');
      expect(ev).toHaveLength(1);
    });

    it('prévia feita só no job do "sim" (nenhuma antes) não é confirmável nele', async () => {
      const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
      const e = await estadoDoSim(dono);
      await usar(e, { numero: pedido.numero, itens: itens15(), confirmado: false });
      const r = await usar(e, { numero: pedido.numero, confirmado: true });
      expect(r._erro).toBe(true);
      expect(r.erro).toContain('próxima mensagem');
      expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
    });
  });

  describe('nova tentativa do mesmo job depois de gravar (re-revisão)', () => {
    const contagem = async () => ({
      notas: (await db.from('chamado_eventos').select('id').eq('chamado_id', pedido.id).eq('tipo', 'nota_interna')).data!.length,
      auditoria: (await db.from('auditoria_acessos').select('id').eq('entidade', 'pedido_venda').eq('entidade_id', pedido.id)).data!.length,
    });
    /** Mesma execução de novo: estado novo, mas a mesma pergunta pendente (o "sim" ainda não foi marcado como respondido). */
    const repetir = async (dono: string, doSim: EstadoAssistente) => {
      const e = await estadoDe(dono);
      e.ctx.perguntaMaisRecenteEm = doSim.ctx.perguntaMaisRecenteEm;
      return e;
    };

    it('a confirmação repetida responde que já estava gravado, sem gravar de novo', async () => {
      const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
      await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
      const doSim = await estadoDoSim(dono);
      expect(await usar(doSim, { numero: pedido.numero, confirmado: true })).toMatchObject({ _erro: false, gravado: true });
      expect(doSim.acoes).toEqual([`pedido #${pedido.numero} alterado`]);

      const e = await repetir(dono, doSim);
      expect(await usar(e, { numero: pedido.numero, confirmado: true })).toMatchObject({ _erro: false, gravado: true, ja_estava: true });
      expect(e.acoes).toEqual([`pedido #${pedido.numero} já estava gravado`]);
      // Uma terceira tentativa também (a resposta anterior já foi um "já estava").
      expect(await usar(await repetir(dono, doSim), { numero: pedido.numero, confirmado: true })).toMatchObject({ _erro: false, ja_estava: true });
      // Pelo laço inteiro: a resposta conta a verdade.
      const historico = await repos.historicoAssistente(dono, 'site', null, 30);
      const r = await executarAssistente({ repos, ia: new IaValidadora([usarFerramentas({ nome: 'alterar_pedido_venda', entrada: { numero: pedido.numero, confirmado: true } }), fimVazio()]), canal: new CanalFalso() },
        (await repetir(dono, doSim)).ctx, historico);
      expect(r.resposta).toEqual([`Feito: pedido #${pedido.numero} já estava gravado.`]);
      expect(await contagem()).toEqual({ notas: 1, auditoria: 1 });
      expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 15 }] });
    });

    it('num job seguinte (nova pergunta depois da gravação), a confirmação continua recusada', async () => {
      const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
      expect(await confirmar(dono, { numero: pedido.numero, itens: itens15() })).toMatchObject({ _erro: false, gravado: true });
      const r = await usar(await estadoDoSim(dono), { numero: pedido.numero, confirmado: true });
      expect(r).toMatchObject({ _erro: true, erro: 'Mostre o antes e o depois de novo e espere a confirmação.' });
    });

    it('gravou mas o registro da gravação falhou: a nova tentativa vê o pedido igual à prévia e responde que já estava', async () => {
      const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
      await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
      const doSim = await estadoDoSim(dono);
      const espiao = vi.spyOn(repos, 'registrarDecisao').mockRejectedValueOnce(new Error('banco caiu'));
      await expect(usar(doSim, { numero: pedido.numero, confirmado: true })).rejects.toThrow('banco caiu');
      espiao.mockRestore();
      expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 15 }] });

      const e = await repetir(dono, doSim);
      expect(await usar(e, { numero: pedido.numero, confirmado: true })).toMatchObject({ _erro: false, gravado: true, ja_estava: true });
      expect(e.acoes).toEqual([`pedido #${pedido.numero} já estava gravado`]);
      expect(await contagem()).toEqual({ notas: 1, auditoria: 1 });
    });

    it('prévia de um pedido que já está assim: a confirmação diz que já estava gravado', async () => {
      const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
      await previa(dono, { numero: pedido.numero, confirmado: false });   // sem mudança nenhuma
      const e = await estadoDoSim(dono);
      expect(await usar(e, { numero: pedido.numero, confirmado: true })).toMatchObject({ _erro: false, ja_estava: true });
      expect(e.acoes).toEqual([`pedido #${pedido.numero} já estava gravado`]);
    });
  });

  it('a prévia de outra pessoa não vale', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const outro = await criarUsuarioTeste({ email: 'outro@teste-corrigir.local', nome: 'Outro' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const r = await usar(await estadoDoSim(outro), { numero: pedido.numero, confirmado: true });
    expect(r._erro).toBe(true);
    expect(r.erro).toContain('Não achei a prévia');
  });

  it('a prévia guardada tem conferência, usuário e conversa; o modelo não recebe a conferência', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const r = await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    expect(r.conferencia).toBeUndefined();
    const { data } = await db.from('decisoes_agente').select('saida').eq('etapa', 'assistente:alterar_pedido_venda').single();
    expect(data!.saida).toMatchObject({ gravado: false, usuario: dono, contexto: 'site:-', conferencia: expect.stringMatching(/^[0-9a-f]{12}$/) });
  });

  it('endereço de entrega: aparece na prévia, é gravado normalizado e volta ao do cadastro ao trocar o destinatário (revisão final, H)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const entrega = { endereco: 'Rua das Flores', numero: '10', bairro: 'Centro', cidade: 'Contagem', uf: 'mg', cep: '32000-000' };
    const r = await previa(dono, { numero: pedido.numero, entrega, confirmado: false });
    expect(r.depois).toContain('Entrega em: Rua das Flores, 10 – Centro – Contagem/MG – CEP 32000-000');
    expect(r.antes).not.toContain('Entrega em');
    await confirmar(dono, { numero: pedido.numero, entrega });
    expect((await salvo()).pedido_venda).toMatchObject({ entrega: { endereco: 'Rua das Flores', numero: '10', complemento: null, uf: 'MG', cep: '32000000' } });
    const t = await previa(dono, { numero: pedido.numero, unidade_id: cad.brasilMatilde, itens: itens15(), confirmado: false });
    expect(t.antes).toContain('Entrega em: Rua das Flores');
    expect(t.depois).not.toContain('Entrega em');
    await confirmar(dono, { numero: pedido.numero, unidade_id: cad.brasilMatilde, itens: itens15() });
    expect((await salvo()).pedido_venda).toMatchObject({ unidade_id: cad.brasilMatilde, entrega: null });
  });

  it('produto e destinatário desativados depois do pedido: a correção sem itens mantém o resumo (revisão final, P)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const antes = (await salvo()).resumo;
    await db.from('produtos').update({ ativo: false }).eq('id', cad.costela);
    await db.from('parceiros_unidades').update({ ativo: false }).eq('id', cad.brasilEfigenia);
    const r = await previa(dono, { numero: pedido.numero, observacoes: 'Manhã', confirmado: false });
    expect(r.antes).toContain('Destinatário: Supermercado Brasil / Santa Efigênia');
    expect(await confirmar(dono, { numero: pedido.numero, observacoes: 'Manhã' })).toMatchObject({ _erro: false, gravado: true });
    const s = await salvo();
    expect(s.resumo).toBe(antes);
    expect(s.resumo).not.toContain('NÃO CADASTRADO');
    // Produto desativado não entra como item novo.
    expect((await usar(await estadoDe(dono), { numero: pedido.numero, itens: itens15(), confirmado: false })).erro).toContain('Produto não é desta empresa');
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

describe('resposta final verdadeira (pedido do dono, 2026-09-29; revisão final, C)', () => {
  /** Uma execução do laço disparada por `pergunta`, com uma IA que recusa requisições que a API recusaria. */
  const rodar = async (dono: string, roteiro: ConstructorParameters<typeof IaRoteirizada>[0], pergunta = 'sim, pode gravar') => {
    const e = await estadoDoSim(dono);
    await db.from('assistente_mensagens').update({ conteudo: pergunta }).eq('usuario_id', dono).is('processada_em', null);
    const historico = await repos.historicoAssistente(dono, 'site', null, 30);
    const ia = new IaValidadora(roteiro);
    const estado = await executarAssistente({ repos, ia, canal: new CanalFalso() }, e.ctx, historico);
    return Object.assign(estado, { ia });
  };

  it('o laço termina em texto solto: lembra uma vez (só com o texto) e usa o texto da última volta', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const e = await rodar(dono, [textoSolto('ok, gravei'), textoSolto('ok, gravei')]);
    expect(e.resposta).toEqual(['ok, gravei']);
    expect(e.ia.recebidos[1]!.messages.at(-2)).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'ok, gravei' }] });
  });

  it('fim vazio: não devolve turno vazio à API (sem erro 400) e responde a mensagem padrão', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const e = await rodar(dono, [fimVazio(), textoSolto('não deveria chegar aqui')]);
    expect(e.ia.recebidos).toHaveLength(1);
    expect(e.resposta).toEqual([MENSAGEM_VAZIA]);
  });

  it('resposta cortada (max_tokens, tool_use pela metade): encerra sem mandar o pedaço de volta', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const e = await rodar(dono, [cortado(), textoSolto('não deveria chegar aqui')]);
    expect(e.ia.recebidos).toHaveLength(1);
    expect(e.resposta).toEqual(['Vou gravar']);
  });

  it('gravou e o modelo termina vazio: responde "Feito: pedido #N alterado"', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const e = await rodar(dono, [usarFerramentas({ nome: 'alterar_pedido_venda', entrada: { numero: pedido.numero, confirmado: true } }), fimVazio(), fimVazio()]);
    expect(e.resposta).toEqual([`Feito: pedido #${pedido.numero} alterado.`]);
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 15 }] });
  });

  it('gravou: os fatos vêm primeiro; texto de antes da ferramenta não entra, o da última volta sim', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    await previa(dono, { numero: pedido.numero, itens: itens15(), confirmado: false });
    const e = await rodar(dono, [
      textoEFerramenta('Não consegui gravar ainda.', 'alterar_pedido_venda', { numero: pedido.numero, confirmado: true }),
      textoSolto('Qualquer coisa, me chame.'), textoSolto('Qualquer coisa, me chame.'),
    ]);
    expect(e.resposta).toEqual([`Feito: pedido #${pedido.numero} alterado.\n\nQualquer coisa, me chame.`]);
  });

  it('a gravação falhou e nada deu certo: responde o motivo da ferramenta, não o texto do modelo', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const e = await rodar(dono, [usarFerramentas({ nome: 'alterar_pedido_venda', entrada: { numero: pedido.numero, confirmado: true } }), textoSolto('Pronto, gravei!'), textoSolto('Pronto, gravei!')]);
    expect(e.resposta).toEqual(['Não consegui gravar: Não achei a prévia deste pedido. Mostre o antes e o depois de novo e espere a confirmação.']);
  });

  it('prévia sem o antes e o depois na resposta: o sistema acrescenta (revisão final, A6)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const e = await rodar(dono, [
      usarFerramentas({ nome: 'alterar_pedido_venda', entrada: { numero: pedido.numero, itens: itens15(), confirmado: false } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Posso gravar?' } }), fim(),
    ], 'o pedido era 15 costela');
    expect(e.resposta).toHaveLength(2);
    expect(e.resposta[0]).toBe('Posso gravar?');
    expect(e.resposta[1]).toBe(`Prévia do pedido #${pedido.numero}:\nAntes:\nDestinatário: Supermercado Brasil / Santa Efigênia\n• 10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00\nTotal: R$ 95,00\nDepois:\nDestinatário: Supermercado Brasil / Santa Efigênia\n• 15 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 142,50\nTotal: R$ 142,50`);
  });

  it('prévia com o depois já na resposta: não repete', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const depois = 'Destinatário: Supermercado Brasil / Santa Efigênia\n• 15 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 142,50\nTotal: R$ 142,50';
    const e = await rodar(dono, [
      usarFerramentas({ nome: 'alterar_pedido_venda', entrada: { numero: pedido.numero, itens: itens15(), confirmado: false } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: `Fica assim:\n${depois}\nPosso gravar?` } }), fim(),
    ], 'o pedido era 15 costela');
    expect(e.resposta).toHaveLength(1);
  });

  it('"corrige e manda o CSV": o CSV é recusado antes do "sim" e nada é gravado (revisão final, B)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-corrigir.local' });
    const e = await rodar(dono, [
      usarFerramentas({ nome: 'alterar_pedido_venda', entrada: { numero: pedido.numero, itens: itens15(), confirmado: false } }),
      usarFerramentas({ nome: 'gerar_csv_bling', entrada: { numeros: [pedido.numero] } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Posso gravar?' } }), fim(),
    ], 'corrige o pedido para 15 costela e me manda o CSV');
    const recusa = JSON.parse(String((e.ia.recebidos[2]!.messages.at(-1)!.content as { content: string }[])[0]!.content));
    expect(recusa).toEqual({ erro: `Grave a correção do pedido #${pedido.numero} antes de gerar o CSV.` });
    expect(e.arquivo).toBeNull();
    expect(e.acoes).toEqual([]);
    expect((await salvo()).pedido_venda).toMatchObject({ itens: [{ quantidade: 10 }] });
  });
});
