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

  it('registrarUsoIa grava funcionalidade, pessoa, conversa, empresa, provedor e segundos', async () => {
    await repos.registrarUsoIa({ funcionalidade: 'transcricao_audio', usuarioId: null, conversaId: null, clienteId: null, modelo: 'whisper-large-v3-turbo',
      provedor: 'groq', tokensEntrada: 0, tokensSaida: 0, tokensCacheLeitura: 0, tokensCacheEscrita: 0, segundosAudio: 42.5, custoUsd: 0.0005 });
    const l = (await db.from('uso_ia').select('funcionalidade, provedor, segundos_audio, usuario_id, cliente_id').single()).data!;
    expect(l).toEqual({ funcionalidade: 'transcricao_audio', provedor: 'groq', segundos_audio: 42.5, usuario_id: null, cliente_id: null });
  });

  it('registrarUsoIa recusa gravar sem funcionalidade ou como nao_identificado (gasto novo assim é bug)', async () => {
    const base = { usuarioId: null, conversaId: null, clienteId: null, modelo: 'm', tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 0.01 };
    // @ts-expect-error funcionalidade é obrigatória
    await expect(repos.registrarUsoIa(base)).rejects.toThrow('registrarUsoIa: funcionalidade obrigatória');
    // @ts-expect-error nao_identificado não é gravável
    await expect(repos.registrarUsoIa({ ...base, funcionalidade: 'nao_identificado' })).rejects.toThrow('registrarUsoIa: funcionalidade obrigatória');
    expect((await db.from('uso_ia').select('id')).data).toEqual([]);
  });

  it('obterConfiguracoes traz o custo por minuto da transcrição', async () => {
    await db.from('configuracoes').update({ custo_minuto_transcricao_usd: 0.000667 }).eq('id', 1);
    expect((await repos.obterConfiguracoes()).custoMinutoTranscricaoUsd).toBeCloseTo(0.000667, 6);
    await db.from('configuracoes').update({ custo_minuto_transcricao_usd: null }).eq('id', 1);
    expect((await repos.obterConfiguracoes()).custoMinutoTranscricaoUsd).toBeNull();
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
