import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);

async function criarEmpresaComContato(telefone: string) {
  const { data: cliente } = await db.from('clientes').insert({ razao_social: 'Indústria X', cnpj: '11222333000181' }).select().single();
  const { data: contato } = await db.from('contatos').insert({ nome: 'João', telefone }).select().single();
  await db.from('contato_clientes').insert({ contato_id: contato!.id, cliente_id: cliente!.id, pode_pedir_nota: true });
  return { cliente: cliente!, contato: contato! };
}

beforeEach(limparBanco);

describe('buscarContato', () => {
  it('encontra o contato pelo número mesmo sem o nono dígito', async () => {
    const { cliente } = await criarEmpresaComContato('5531999990001');
    const achado = await repos.buscarContato('553199990001');
    expect(achado?.nome).toBe('João');
    expect(achado?.empresas).toEqual([{ id: cliente.id, nome: 'Indústria X', podePedirNota: true, agentePausado: false }]);
  });
  it('devolve null para número desconhecido', async () => {
    expect(await repos.buscarContato('5531988887777')).toBeNull();
  });
});

describe('inserirMensagemEntrada', () => {
  it('não duplica a mesma mensagem do provedor', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const base = { conversaId: conversa.id, clienteId: null, idProvedor: 'ABC', tipo: 'texto' as const, conteudo: 'oi' };
    const a = await repos.inserirMensagemEntrada(base);
    const b = await repos.inserirMensagemEntrada(base);
    expect(a.duplicada).toBe(false);
    expect(b.duplicada).toBe(true);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(1);
  });
});

describe('obterOuCriarConversa', () => {
  it('reaproveita a conversa do mesmo telefone e liga o contato depois de cadastrado', async () => {
    const c1 = await repos.obterOuCriarConversa('5531999990001', null);
    const { contato } = await criarEmpresaComContato('5531999990001');
    const c2 = await repos.obterOuCriarConversa('5531999990001', contato.id);
    expect(c2.id).toBe(c1.id);
    expect(c2.contato_id).toBe(contato.id);
  });
});

describe('abrirChamado', () => {
  it('numera em sequência e registra o evento de criação', async () => {
    const { cliente } = await criarEmpresaComContato('5531999990001');
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
    const novo = { clienteId: cliente.id, conversaId: conversa.id, setorId: fiscal!.id, responsavelId: null,
      titulo: 'Guia DAS', resumo: 'Cliente pediu a guia de setembro', foraDoContrato: false, origem: 'agente' };
    const a = await repos.abrirChamado(novo);
    const b = await repos.abrirChamado({ ...novo, titulo: 'Holerite' });
    expect(b.numero).toBe(a.numero + 1);
    const { count } = await db.from('chamado_eventos').select('*', { count: 'exact', head: true }).eq('chamado_id', a.id);
    expect(count).toBe(1);
  });
});

describe('custoIaDoMes', () => {
  it('soma só o mês pedido', async () => {
    await repos.registrarUsoIa({ conversaId: null, modelo: 'claude-sonnet-5', tokensEntrada: 10, tokensSaida: 5,
      tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 1.5 });
    const mes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).slice(0, 7);
    expect(await repos.custoIaDoMes(mes)).toBeCloseTo(1.5);
    expect(await repos.custoIaDoMes('2000-01')).toBe(0);
  });
});

describe('obterConfiguracoes', () => {
  it('converte horários para HH:MM e lê feriados', async () => {
    await db.from('feriados').upsert({ data: '2026-10-12', descricao: 'Nossa Senhora Aparecida' });
    const cfg = await repos.obterConfiguracoes();
    expect(cfg.expediente.inicio).toBe('08:00');
    expect(cfg.expediente.feriados).toContain('2026-10-12');
    expect(cfg.modeloConversa).toBe('claude-sonnet-5');
  });
});

describe('ehTelefoneInterno', () => {
  it('reconhece o telefone do dono', async () => {
    await db.from('configuracoes').update({ telefone_dono: '5531977770000' }).eq('id', 1);
    expect(await repos.ehTelefoneInterno('553177770000')).toBe(true);
    expect(await repos.ehTelefoneInterno('5531999990001')).toBe(false);
  });
});
