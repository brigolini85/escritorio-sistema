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

  it('busca demanda pelo número com setor, empresa e pedido; busca empresas', async () => {
    const { data: c } = await db.from('clientes').insert({ razao_social: 'Indústria X Ltda', nome_fantasia: 'Indústria X', cnpj: '11222333000181' }).select().single();
    const { id: chamadoId, numero } = await repos.abrirChamado({ clienteId: c!.id, conversaId: null, setorId: await repos.setorPorNome('Fiscal'),
      responsavelId: null, titulo: 'NF de venda – X', resumo: 'r', foraDoContrato: false, origem: 'agente' });
    const achado = await repos.chamadoPorNumero(numero);
    expect(achado).toMatchObject({ id: chamadoId, numero, setor: 'Fiscal', empresa: 'Indústria X', status: 'aberto', pedido_venda: null });
    expect(await repos.chamadoPorNumero(999999)).toBeNull();
    expect((await repos.buscarEmpresas('industria x')).map((e) => e.nome)).toEqual(['Indústria X']);
    expect((await repos.buscarEmpresas('11.222.333')).map((e) => e.cnpj)).toEqual(['11222333000181']);
  });
});
