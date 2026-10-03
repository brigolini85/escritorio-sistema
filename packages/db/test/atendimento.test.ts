import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';
import { criarUsuario } from './usuario';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);

beforeEach(limparBanco);

async function conversa() {
  return repos.obterOuCriarConversa('5531977771111', null);
}

describe('repositório da Parte E', () => {
  it('marca a passagem uma vez e não marca conversa assumida', async () => {
    const c = await conversa();
    expect(await repos.marcarAguardandoPessoa(c.id, 'pediu para falar com pessoa')).toBe(true);
    expect(await repos.marcarAguardandoPessoa(c.id, 'falha no agente de IA')).toBe(false);
    expect((await repos.obterConversa(c.id)).motivo_pessoa).toBe('pediu para falar com pessoa');
    const outra = await repos.obterOuCriarConversa('5531977772222', null);
    await repos.atualizarConversa(outra.id, { estado: 'humano' });
    expect(await repos.marcarAguardandoPessoa(outra.id, 'agente pausado')).toBe(false);
  });

  it('mensagem e decisão guardam o turno; mensagem guarda o documento', async () => {
    const c = await conversa();
    const { data: cliente } = await db.from('clientes').insert({ razao_social: 'Doc Ltda', cnpj: '11222333000181' }).select().single();
    const { data: doc } = await db.from('documentos_empresa')
      .insert({ cliente_id: cliente!.id, nome: 'Contrato social', arquivo_path: 'x/contrato.pdf', arquivo_nome: 'contrato.pdf' }).select().single();
    const turno = '11111111-1111-4111-8111-111111111111';
    const id = await repos.criarSaidaPendente({ conversaId: c.id, clienteId: cliente!.id, autor: 'agente', conteudo: 'Contrato social', turnoAgente: turno, documentoId: doc!.id });
    await repos.registrarDecisao({ conversaId: c.id, clienteId: null, etapa: 'enviar_documento', entrada: {}, saida: {}, turno });
    const m = await repos.obterMensagem(id);
    expect(m.turno_agente).toBe(turno);
    expect(m.documento_id).toBe(doc!.id);
    expect((await db.from('decisoes_agente').select('turno').eq('conversa_id', c.id).single()).data!.turno).toBe(turno);
  });

  it('uso de IA com funcionalidade e pessoa; sem elas continua como antes', async () => {
    const pessoa = await criarUsuario(db, 'uso@atendimento.local');
    await repos.registrarUsoIa({ conversaId: null, modelo: 'm', tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 0.01,
      funcionalidade: 'sugerir_resposta', usuarioId: pessoa });
    await repos.registrarUsoIa({ conversaId: null, modelo: 'm', tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 0.01 });
    const linhas = (await db.from('uso_ia').select('funcionalidade, usuario_id').order('funcionalidade', { nullsFirst: true })).data!;
    expect(linhas).toEqual([{ funcionalidade: null, usuario_id: null }, { funcionalidade: 'sugerir_resposta', usuario_id: pessoa }]);
  });

  it('sugestão: lê e conclui uma vez só (só sai de pendente)', async () => {
    const c = await conversa();
    const pessoa = await criarUsuario(db, 'sugestao@atendimento.local');
    const { data: s } = await db.from('sugestoes_resposta').insert({ usuario_id: pessoa, conversa_id: c.id }).select().single();
    expect((await repos.obterSugestao(s!.id))!.status).toBe('pendente');
    expect(await repos.concluirSugestao(s!.id, { status: 'pronta', texto: 'Oi, Carla!' })).toBe(true);
    expect(await repos.concluirSugestao(s!.id, { status: 'falhou', erro: 'x' })).toBe(false);
    expect(await repos.obterSugestao(s!.id)).toMatchObject({ status: 'pronta', texto: 'Oi, Carla!', erro: null });
    expect(await repos.obterSugestao('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
