import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  erro: null as { code: string; message: string } | null, dados: true as unknown, chamadas: [] as [string, unknown][], revalidados: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'admin', niveis: {}, setores: [] }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({ rpc: async (nome: string, args: unknown) => { falso.chamadas.push([nome, args]); return { data: falso.dados, error: falso.erro }; } }),
}));
const acoes = await import('./radar-acoes');
const N = '11111111-1111-4111-8111-111111111111';
const S = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const FALHA = 'Não foi possível salvar agora. Tente de novo.';

beforeEach(() => { Object.assign(falso, { erro: null, dados: true, chamadas: [], revalidados: [] }); vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('ações do Radar', () => {
  it('pedir giro chama só o banco (o trabalhador pega no minuto seguinte)', async () => {
    falso.dados = N;
    expect(await acoes.pedirGiroRadar()).toEqual({ ok: true });
    expect(falso.chamadas).toEqual([['pedir_giro_radar', {}]]);
    expect(falso.revalidados).toContain('/agentes/radar');
  });
  it('procurar fonte oficial', async () => {
    expect(await acoes.procurarFonteOficial(N)).toEqual({ ok: true });
    expect(falso.chamadas).toEqual([['procurar_fonte_oficial_radar', { p_novidade: N }]]);
    expect(falso.revalidados).toContain('/agentes/radar');
  });
  it('fonte: endereço inválido não chega ao banco; válido separa domínio e caminho', async () => {
    const dados = { nome: 'eSocial', etiqueta: 'FED', oficial: true, ativa: true, paginas: [] };
    const r = await acoes.salvarFonteRadar(null, { ...dados, endereco: 'ftp://x' });
    expect(r.ok).toBe(false);
    expect(falso.chamadas).toEqual([]);
    expect(await acoes.salvarFonteRadar(null, { ...dados, endereco: 'https://www.gov.br/esocial/pt-br' })).toEqual({ ok: true });
    expect(falso.chamadas).toEqual([['salvar_fonte_radar', { p_id: null, p_dados: { nome: 'eSocial', dominio: 'gov.br', caminho: '/esocial/pt-br', etiqueta: 'FED', oficial: true, ativa: true, paginas: [] } }]]);
    expect(falso.revalidados).toContain('/agentes/radar');
  });
  it('fonte: id estranho não chega ao banco', async () => {
    const r = await acoes.salvarFonteRadar('x', { nome: 'a', endereco: 'cfc.org.br', etiqueta: 'FED', oficial: true, ativa: true, paginas: [] });
    expect(r).toEqual({ ok: false, erro: 'Fonte não encontrada.' });
    expect(await acoes.removerFonteRadar('x')).toEqual({ ok: false, erro: 'Fonte não encontrada.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('remover fonte e salvar config', async () => {
    expect(await acoes.removerFonteRadar(S)).toEqual({ ok: true });
    expect(await acoes.salvarConfigRadar({ hora: '08:00', dias: [1] })).toEqual({ ok: true });
    expect(falso.chamadas).toEqual([['remover_fonte_radar', { p_id: S }], ['salvar_config_radar', { p_dados: { hora: '08:00', dias: [1] } }]]);
  });
  it('ligar e desligar usam salvar_agente', async () => {
    await acoes.ligarRadar(true);
    await acoes.ligarRadar(false);
    expect(falso.chamadas).toEqual([['salvar_agente', { p_slug: 'radar', p_dados: { estado: 'ligado' } }], ['salvar_agente', { p_slug: 'radar', p_dados: { estado: 'desligado' } }]]);
    expect(falso.revalidados).toContain('/agentes/radar');
  });
  it('criar demanda devolve id e número', async () => {
    falso.dados = { id: C, numero: 77 };
    expect(await acoes.criarDemandaRadar(N, S)).toEqual({ ok: true, id: C, numero: 77 });
    expect(falso.chamadas).toEqual([['criar_demanda_radar', { p_novidade: N, p_setor: S }]]);
    expect(falso.revalidados).toContain('/agentes/radar');
  });
  it('avisar, descartar e salvar mensagem', async () => {
    expect(await acoes.avisarEquipeRadar(N)).toEqual({ ok: true });
    expect(await acoes.descartarNovidadeRadar(N)).toEqual({ ok: true });
    expect(await acoes.salvarMensagemRadar(N, 'Olá, houve mudança.')).toEqual({ ok: true });
    expect(falso.chamadas).toEqual([['avisar_equipe_radar', { p_novidade: N }], ['descartar_novidade_radar', { p_novidade: N }], ['salvar_mensagem_radar', { p_novidade: N, p_texto: 'Olá, houve mudança.' }]]);
  });
  it('aprovar envio devolve quantos contatos; mais de 200 clientes não chega ao banco', async () => {
    falso.dados = 5;
    expect(await acoes.aprovarEnvioRadar(N, S, [C], 'Olá')).toEqual({ ok: true, contatos: 5 });
    expect(falso.chamadas).toEqual([['aprovar_envio_radar', { p_novidade: N, p_setor: S, p_clientes: [C], p_texto: 'Olá' }]]);
    falso.chamadas = [];
    const muitos = Array.from({ length: 201 }, () => C);
    expect(await acoes.aprovarEnvioRadar(N, S, muitos, 'Olá')).toEqual({ ok: false, erro: 'Até 200 clientes por envio.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('leituras de clientes afetados e contatos', async () => {
    falso.dados = [{ cliente_id: C, nome: 'Padaria', regime: 'simples', uf: 'MG', cidade: 'Lafaiete' }];
    expect(await acoes.lerClientesAfetados(N)).toEqual({ ok: true, clientes: [{ id: C, nome: 'Padaria', regime: 'simples', uf: 'MG', cidade: 'Lafaiete' }] });
    falso.dados = [{ cliente_id: C, nome: 'Padaria', contatos: 2 }];
    expect(await acoes.lerContatosParaEnvio(N, S)).toEqual({ ok: true, clientes: [{ id: C, nome: 'Padaria', contatos: 2 }] });
    expect(falso.chamadas.map((c) => c[0])).toEqual(['clientes_afetados_radar', 'contatos_para_envio_radar']);
  });
  it('uuid inválido: "Novidade não encontrada." sem chamar o banco', async () => {
    expect(await acoes.descartarNovidadeRadar('x')).toEqual({ ok: false, erro: 'Novidade não encontrada.' });
    expect(await acoes.criarDemandaRadar(N, 'x')).toEqual({ ok: false, erro: 'Novidade não encontrada.' });
    expect(await acoes.aprovarEnvioRadar('x', S, [], 'a')).toEqual({ ok: false, erro: 'Novidade não encontrada.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('P0001 volta como a frase do banco; outro erro vira a frase genérica', async () => {
    falso.erro = { code: 'P0001', message: 'Só o dono altera o Radar.' };
    expect(await acoes.salvarConfigRadar({ hora: '08:00' })).toEqual({ ok: false, erro: 'Só o dono altera o Radar.' });
    expect(falso.revalidados).toEqual([]);
    falso.erro = { code: '57014', message: 'timeout' };
    expect(await acoes.descartarNovidadeRadar(N)).toEqual({ ok: false, erro: FALHA });
  });
});
