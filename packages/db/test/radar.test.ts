import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarReposRadar, SemI5, type Db } from '../src';
import { limparBanco, sqlTeste } from './limpar';
import { configRadarTeste, contatoProcuravelTeste, giroRadarTeste, ligarRadarTeste, novidadeRadarTeste } from './radar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const r = criarReposRadar(db);
const agora = new Date('2026-10-26T10:05:00Z');   // 07:05 em São Paulo

beforeEach(limparBanco);

describe('repositório do Radar (Tasks 2 e 3)', () => {
  it('abre o agendado do dia, pega e conclui', async () => {
    await ligarRadarTeste('ligado');
    expect(await r.abrirGirosRadar(agora)).toBe('agenda');
    const g = await r.pegarGiroRadar();
    expect(g).toMatchObject({ origem: 'agenda', pedidoPor: null, novidade: null });
    expect(g!.fontes).toHaveLength(9);
    expect(g!.config).toMatchObject({ hora: '07:00', resumoWhatsapp: true, avisoAlto: true, avisarPainel: false, limiteUsdGiro: 0.5 });
    expect(await r.pegarGiroRadar()).toBeNull();
    await r.somarCustoGiro(g!.id, 0.0123);
    await r.concluirGiroRadar(g!.id, { estado: 'concluido', fontes: 9, paginas: 4, buscas: 3, fontesFora: [], lidas: [{ url: 'https://gov.br/esocial/x', titulo: 'x' }], resumo: 'ok', erro: null });
    const [linha] = await sqlTeste<{ estado: string; custo_usd: string; paginas: number }>('select estado, custo_usd, paginas from public.radar_giros where id = $1', [g!.id]);
    expect(linha).toEqual({ estado: 'concluido', custo_usd: '0.012300', paginas: 4 });
  });

  it('registra nova, repetida e confirmar', async () => {
    await ligarRadarTeste('ligado');
    await r.abrirGirosRadar(agora);
    const g = (await r.pegarGiroRadar())!;
    const setor = g.setores.find((s) => s.nome === 'Fiscal')!.id;
    const base = { titulo: 'Novo prazo da DeSTDA', url: 'https://www.fazenda.mg.gov.br/noticias/1', urlNormalizada: 'fazenda.mg.gov.br/noticias/1',
      publicadoEm: '2026-10-01', resumo: 'A SEFAZ-MG mudou o prazo da declaração.', impacto: 'medio' as const, setores: [setor],
      criterios: { ufs: ['MG'] }, vigenciaInicio: null, vigenciaTexto: 'vale a partir de 01/11/2026', mensagemCliente: 'Olá!', assunto: 'Estaduais de MG' };
    expect(await r.registrarNovidadeRadar(g.id, base)).toMatchObject({ situacao: 'nova', selo: 'oficial', clientes: 0 });
    expect(await r.registrarNovidadeRadar(g.id, base)).toEqual({ situacao: 'repetida' });
    expect(await r.registrarNovidadeRadar(g.id, { ...base, titulo: 'Outra', url: 'https://www.contabeis.com.br/n/1', urlNormalizada: 'contabeis.com.br/n/1' }))
      .toMatchObject({ situacao: 'nova', selo: 'confirmar' });
  });

  it('envio aprovado: lista, reserva, marca; avisos e resumo', async () => {
    const [cl] = await sqlTeste<{ id: string }>(`insert into public.clientes (razao_social, cnpj, regime, uf, segmentos) values ('Padaria Sol', '21448390000107', 'Simples Nacional', 'MG', '{comercio}') returning id`);
    const joao = await contatoProcuravelTeste({ clienteId: cl!.id, nome: 'João', telefone: '5531999990001', setor: 'Fiscal' });
    const n = await novidadeRadarTeste({ titulo: 'Mudou o ICMS', url: 'https://www.fazenda.mg.gov.br/x', impacto: 'alto', setores: ['Fiscal'], criterios: { ufs: ['MG'] } });
    expect(await r.enviosRadarParaEnviar(10)).toEqual([]);   // nada sem aprovação
    const [setor] = await sqlTeste<{ id: string }>(`select id from public.setores where nome = 'Fiscal'`);
    await sqlTeste(`insert into public.radar_envios (novidade_id, setor_id, cliente_id, contato_id, texto) values ($1, $2, $3, $4, 'Olá!')`, [n, setor!.id, cl!.id, joao]);
    const [id] = await r.enviosRadarParaEnviar(10);
    const e = await r.reservarEnvioRadar(id!);
    expect(e).toMatchObject({ contatoId: joao, telefone: '5531999990001', texto: 'Olá!' });
    expect(await r.reservarEnvioRadar(id!)).toBeNull();
    await r.liberarEnvioRadar(id!);
    expect(await r.reservarEnvioRadar(id!)).not.toBeNull();
    await sqlTeste(`update public.configuracoes set telefone_dono = '5531988887777'`);
    const aviso = await r.avisarNovidadeNova(n);
    expect(aviso).toMatchObject({ whatsapp: true, titulo: 'Mudou o ICMS' });
    expect((await r.avisarNovidadeNova(n)).whatsapp).toBe(false);
    const g = await giroRadarTeste({ origem: 'agenda', estado: 'concluido', novidades: 1 });
    await sqlTeste('update public.radar_novidades set giro_id = $1 where id = $2', [g, n]);
    expect(await r.reservarResumoRadar(g)).toMatchObject({ novidades: [{ titulo: 'Mudou o ICMS', impacto: 'alto' }], fontesFora: [] });
    expect(await r.reservarResumoRadar(g)).toBeNull();
    await configRadarTeste({ resumo_whatsapp: false });
  });

  it('banco sem a I5 lança SemI5; outro erro lança Error com contexto', async () => {
    const falso = (code: string) => ({ rpc: async () => ({ data: null, error: { code, message: 'x' } }) }) as unknown as Db;
    const semI5 = criarReposRadar(falso('PGRST202'));
    await expect(semI5.abrirGirosRadar(agora)).rejects.toBeInstanceOf(SemI5);
    await expect(semI5.pegarGiroRadar()).rejects.toBeInstanceOf(SemI5);
    const outro = criarReposRadar(falso('XX000'));
    const erro = await outro.pegarGiroRadar().catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro).not.toBeInstanceOf(SemI5);
    expect((erro as Error).message).toContain('pegarGiroRadar: ');
  });
});
