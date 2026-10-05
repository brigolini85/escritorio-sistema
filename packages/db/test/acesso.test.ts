import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';

// Parte H2 (spec 7D.2, D9): o trabalhador lê o acesso e o que ele permite pelas funções do banco.
const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
const setor = async (nome: string) => (await db.from('setores').select('id').eq('nome', nome).single()).data!.id;
// Preparo que falha em silêncio mediria outra coisa (revisão das Tasks 3–4): erro aqui para o teste.
const semErro = <T extends { error: { message: string } | null }>(r: T): T => { if (r.error) throw new Error(r.error.message); return r; };

let cliente: string;
let carla: string;
let roberto: string;
beforeEach(async () => {
  await limparBanco();
  cliente = semErro(await db.from('clientes').insert({ razao_social: 'Rede Bom Preço Ltda', cnpj: '11222333000181' }).select('id').single()).data!.id;
  carla = semErro(await db.from('contatos').insert({ nome: 'Carla Mendes', telefone: '5511977772211' }).select('id').single()).data!.id;
  roberto = semErro(await db.from('contatos').insert({ nome: 'Roberto Faria', telefone: '5511988880001' }).select('id').single()).data!.id;
  // Linhas com chaves diferentes: sem defaultToNull: false o PostgREST manda null nas colunas que faltam (e o not null recusa).
  semErro(await db.from('contato_clientes').insert([
    { contato_id: carla, cliente_id: cliente, perfil: 'compras_vendas', pode_pedir_nota: true, receber_documentos: true, avisar_documento_novo: ['whatsapp'] },
    { contato_id: roberto, cliente_id: cliente, perfil: 'socio', ver_valores: true, receber_documentos: true, recebe_alertas_acesso: true },
  ], { defaultToNull: false }));
  semErro(await db.from('contato_cliente_setores').insert({ contato_id: carla, cliente_id: cliente, setor_id: await setor('Fiscal'), pode_ser_procurado: true }));
});

describe('acesso do contato', () => {
  it('lê as marcações em camelCase', async () => {
    expect(await repos.acessoDoContato(carla, cliente)).toEqual({
      perfil: 'compras_vendas', setores: [{ id: await setor('Fiscal'), nome: 'Fiscal', podeSerProcurado: true }],
      podePedirNota: true, podeAtualizarPreco: false, verValores: false, receberDocumentos: true, avisarDocumentoNovo: ['whatsapp'], recebeAlertasAcesso: false,
    });
  });
  it('sem vínculo: null', async () => {
    const outra = semErro(await db.from('clientes').insert({ razao_social: 'Outra', cnpj: '11444777000161' }).select('id').single()).data!.id;
    expect(await repos.acessoDoContato(carla, outra)).toBeNull();
  });
  it('documentos e demandas filtrados', async () => {
    semErro(await db.from('documentos_empresa').insert([
      { cliente_id: cliente, nome: 'Certidão', arquivo_path: 'a/c.pdf', arquivo_nome: 'c.pdf', ia_pode_enviar: true, setor_id: await setor('Fiscal') },
      { cliente_id: cliente, nome: 'Folha', arquivo_path: 'a/f.pdf', arquivo_nome: 'f.pdf', ia_pode_enviar: true, setor_id: await setor('Pessoal'), tem_valores: true },
    ], { defaultToNull: false }));
    expect((await repos.documentosParaContato(carla, cliente)).map((d) => [d.nome, d.iaPodeEnviar])).toEqual([['Certidão', true]]);
    const conversa = await repos.obterOuCriarConversa('5511977772211', carla);
    semErro(await db.from('chamados').insert([
      { cliente_id: cliente, setor_id: await setor('Fiscal'), titulo: 'Guia' },
      { cliente_id: cliente, setor_id: await setor('Pessoal'), titulo: 'Admissão' },
    ], { defaultToNull: false }));
    expect((await repos.demandasParaContato(carla, cliente, conversa.id)).map((c) => [c.titulo, c.setor_nome])).toEqual([['Guia', 'Fiscal']]);
  });
  it('pedido fora do acesso: novo uma vez por dia; sócios sem quem pediu', async () => {
    const pessoal = await setor('Pessoal');
    const a = await repos.registrarPedidoForaDoAcesso({ contatoId: carla, clienteId: cliente, setorId: pessoal, dia: '2026-10-13' });
    expect(a.novo).toBe(true);
    const { id: chamadoId } = await repos.abrirChamado({ clienteId: cliente, conversaId: null, setorId: pessoal, responsavelId: null,
      titulo: 'Fora do acesso: folha', resumo: 'x', foraDoContrato: false, origem: 'agente' });
    await repos.concluirPedidoForaDoAcesso(a.id, chamadoId, 1);
    expect(await repos.registrarPedidoForaDoAcesso({ contatoId: carla, clienteId: cliente, setorId: pessoal, dia: '2026-10-13' }))
      .toEqual({ id: a.id, novo: false, chamadoId });
    expect(await repos.sociosParaAlerta(cliente, carla)).toEqual([{ contatoId: roberto, nome: 'Roberto Faria', telefone: '5511988880001' }]);
    expect(await repos.contatosProcuraveis(cliente, await setor('Fiscal'))).toEqual([{ contatoId: carla, nome: 'Carla Mendes', telefone: '5511977772211' }]);
    await repos.registrarNotaDoSistema(chamadoId, cliente, 'Nota do agente');
    const { data } = await db.from('chamado_eventos').select('tipo, usuario_id, texto').eq('chamado_id', chamadoId).eq('tipo', 'nota_interna');
    expect(data).toEqual([{ tipo: 'nota_interna', usuario_id: null, texto: 'Nota do agente' }]);
  });
});
