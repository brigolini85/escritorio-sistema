import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);

async function usuario(email: string, extra: object = {}) {
  const antigo = (await db.from('usuarios').select('id').eq('email', email).maybeSingle()).data;
  if (antigo) await db.auth.admin.deleteUser(antigo.id);
  const { data } = await db.auth.admin.createUser({ email, password: 'Senha-teste-123', email_confirm: true });
  await db.from('usuarios').insert({ id: data.user!.id, nome: 'Dono', email, ...extra });
  return data.user!.id;
}

beforeEach(async () => { await limparBanco(); });

describe('repositório do assistente (pedido do dono, 2026-09-29)', () => {
  it('reconhece o usuário do assistente pelo WhatsApp com ou sem o 9; ignora inativo e sem permissão', async () => {
    const id = await usuario('dono@teste-repos.local', { papel: 'admin', telefone: '5531988887777', permissoes: ['assistente_whatsapp'] });
    expect((await repos.usuarioDoAssistente('553188887777'))?.id).toBe(id);
    expect((await repos.usuarioDoAssistente('5531988887777'))?.id).toBe(id);
    await db.from('usuarios').update({ permissoes: ['assistente_site'] }).eq('id', id);
    expect(await repos.usuarioDoAssistente('5531988887777')).toBeNull();
    await db.from('usuarios').update({ permissoes: ['assistente_whatsapp'], ativo: false }).eq('id', id);
    expect(await repos.usuarioDoAssistente('5531988887777')).toBeNull();
  });

  it('guarda perguntas e respostas, lista pendentes e o histórico em ordem', async () => {
    const id = await usuario('ana@teste-repos.local', { permissoes: ['assistente_site'] });
    await repos.registrarMensagemAssistente({ usuarioId: id, canal: 'site', conversaId: null, papel: 'usuario', conteudo: 'oi' });
    await repos.registrarMensagemAssistente({ usuarioId: id, canal: 'site', conversaId: null, papel: 'usuario', conteudo: 'quais notas?' });
    const pendentes = await repos.perguntasPendentes(id, 'site', null);
    expect(pendentes.map((m) => m.conteudo)).toEqual(['oi', 'quais notas?']);
    await repos.marcarPerguntasRespondidas(pendentes.map((m) => m.id));
    await repos.registrarMensagemAssistente({ usuarioId: id, canal: 'site', conversaId: null, papel: 'assistente', conteudo: 'Nenhuma.', processada: true });
    expect(await repos.perguntasPendentes(id, 'site', null)).toEqual([]);
    expect((await repos.historicoAssistente(id, 'site', null, 30)).map((m) => `${m.papel}:${m.conteudo}`))
      .toEqual(['usuario:oi', 'usuario:quais notas?', 'assistente:Nenhuma.']);
  });

  it('pendentes com limite, perguntas paradas e a última chamada de correção de qualquer resultado (revisão final)', async () => {
    const id = await usuario('ana@teste-repos.local', { permissoes: ['assistente_whatsapp'], telefone: '5531977776666' });
    for (const c of ['1', '2', '3']) await repos.registrarMensagemAssistente({ usuarioId: id, canal: 'whatsapp', conversaId: null, papel: 'usuario', conteudo: c });
    expect((await repos.perguntasPendentes(id, 'whatsapp', null, 2)).map((m) => m.conteudo)).toEqual(['1', '2']);
    expect(await repos.perguntasAssistenteParadas(2)).toEqual([]);
    await db.from('assistente_mensagens').update({ criado_em: new Date(Date.now() - 10 * 60_000).toISOString() }).eq('usuario_id', id);
    expect(await repos.perguntasAssistenteParadas(2)).toEqual([{ usuarioId: id, canal: 'whatsapp', conversaId: null, telefone: '5531977776666' }]);

    const etapa = 'assistente:alterar_pedido_venda';
    await repos.registrarDecisao({ conversaId: null, clienteId: null, etapa, entrada: { numero: 7, confirmado: false }, saida: { gravado: false, conferencia: 'abc', usuario: id } });
    const previa = await repos.ultimaPreviaDoAssistente(id, 7, new Date(Date.now() - 60_000));
    expect(previa).toMatchObject({ entrada: { numero: 7 }, saida: { gravado: false, conferencia: 'abc' } });
    expect(previa!.criadoEm).toBeInstanceOf(Date);
    await repos.registrarDecisao({ conversaId: null, clienteId: null, etapa, entrada: { numero: 7, confirmado: true }, saida: { erro: 'x', usuario: id } });
    expect((await repos.ultimaPreviaDoAssistente(id, 7, new Date(Date.now() - 60_000)))!.saida).toEqual({ erro: 'x', usuario: id });
    expect(await repos.ultimaPreviaDoAssistente(id, 8, new Date(Date.now() - 60_000))).toBeNull();
    // Com `ate`: só as chamadas anteriores a ele (a prévia mostrada antes da última mensagem da pessoa).
    const { data: linhas } = await db.from('decisoes_agente').select('criado_em, saida').eq('etapa', etapa).order('criado_em');
    const segunda = new Date(linhas![1]!.criado_em);
    expect((await repos.ultimaPreviaDoAssistente(id, 7, new Date(Date.now() - 60_000), segunda))!.saida).toMatchObject({ conferencia: 'abc' });
    expect(await repos.ultimaPreviaDoAssistente(id, 7, new Date(Date.now() - 60_000), new Date(linhas![0]!.criado_em))).toBeNull();
  });

  it('unidades e produtos inativos só com incluirInativos (revisão final, P)', async () => {
    const { data: c } = await db.from('clientes').insert({ razao_social: 'Indústria P', cnpj: '33444555000166' }).select().single();
    const { data: g } = await db.from('parceiros_grupos').insert({ cliente_id: c!.id, tipo: 'cliente', nome: 'Rede', ativo: false }).select().single();
    await db.from('parceiros_unidades').insert({ cliente_id: c!.id, grupo_id: g!.id, nome_unidade: 'Loja' });
    await db.from('produtos').insert({ cliente_id: c!.id, codigo: '1', descricao: 'Velho', ativo: false });
    expect(await repos.unidadesDaEmpresa(c!.id, 'cliente')).toEqual([]);
    expect((await repos.unidadesDaEmpresa(c!.id, 'cliente', { incluirInativos: true })).map((u) => u.unidade)).toEqual(['Loja']);
    expect(await repos.produtosDaEmpresa(c!.id)).toEqual([]);
    expect((await repos.produtosDaEmpresa(c!.id, { incluirInativos: true })).map((p) => p.descricao)).toEqual(['Velho']);
  });

  it('busca demanda pelo número com setor, empresa e pedido; busca empresas', async () => {
    const { data: c } = await db.from('clientes').insert({ razao_social: 'Indústria X Ltda', nome_fantasia: 'Indústria X', cnpj: '11222333000181' }).select().single();
    const { id: chamadoId, numero } = await repos.abrirChamado({ clienteId: c!.id, conversaId: null, setorId: await repos.setorPorNome('Fiscal'),
      responsavelId: null, titulo: 'NF de venda – X', resumo: 'r', foraDoContrato: false, origem: 'agente' });
    const achado = await repos.chamadoPorNumero(numero);
    expect(achado).toMatchObject({ id: chamadoId, numero, setor: 'Fiscal', empresa: 'Indústria X', status: 'aberto', pedido_venda: null });
    expect(await repos.chamadoPorNumero(999999)).toBeNull();
    expect((await repos.buscarEmpresas('industria x')).map((e) => e.nome)).toEqual(['Indústria X']);
    expect((await repos.buscarEmpresas('11.222.333')).map((e) => e.cnpj)).toEqual(['11222333000181']);
    expect(await repos.buscarEmpresas('   ')).toEqual([]);
    expect(await repos.buscarEmpresas('"')).toEqual([]);
  });

  it('lista demandas só as visíveis para o usuário, só com pedido, com limite e sem limite', async () => {
    const { data: c } = await db.from('clientes').insert({ razao_social: 'Cliente V Ltda', cnpj: '22333444000155' }).select().single();
    const { data: setores } = await db.from('setores').select('id, nome').eq('ativo', true).limit(2);
    const [meu, outro] = [setores![0]!.id, setores![1]!.id];
    const ana = await usuario('ana-vis@teste-repos.local');
    const abrir = (titulo: string, setorId: string | null, responsavelId: string | null) =>
      repos.abrirChamado({ clienteId: c!.id, conversaId: null, setorId, responsavelId, titulo, resumo: 'r', foraDoContrato: false, origem: 'agente' });
    const doSetor = await abrir('do meu setor', meu, null);
    await abrir('de outro setor', outro, null);
    await abrir('triagem', null, null);
    const minha = await abrir('sou responsável', outro, ana);
    const visiveis = await repos.chamadosRecentes({ visivelPara: { usuarioId: ana, setorIds: [meu] } });
    expect(visiveis.map((v) => v.titulo).sort()).toEqual(['do meu setor', 'sou responsável']);
    expect(visiveis.map((v) => v.id).sort()).toEqual([doSetor.id, minha.id].sort());
    const semSetor = await repos.chamadosRecentes({ visivelPara: { usuarioId: ana, setorIds: [] } });
    expect(semSetor.map((v) => v.titulo)).toEqual(['sou responsável']);
    expect(await repos.chamadosRecentes({ visivelPara: null })).toHaveLength(4);

    await repos.atualizarPedidoVenda(doSetor.id, { pedido: { unidade_id: null } as never, resumo: 'com pedido' });
    expect((await repos.chamadosRecentes({ comPedido: true })).map((v) => v.id)).toEqual([doSetor.id]);
    expect(await repos.chamadosRecentes({ limite: 1 })).toHaveLength(1);
    expect(await repos.chamadosRecentes({})).toHaveLength(4);
  });
});
