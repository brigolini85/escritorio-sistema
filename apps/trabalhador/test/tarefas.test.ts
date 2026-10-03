import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio } from '../src/envio';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { MSG_WHATSAPP_DESCONECTADO, alertaFila, alertaVencimento, batimento, inicioDoDiaSP, montarResumo, resumoDiario, type DepsTarefas } from '../src/tarefas';
import { db, repos, setorId } from './apoio/cenario';
import { EmailFalso } from './apoio/email-falso';
import { FilaFalsa } from './apoio/fila-falsa';
import { criarUsuarioTeste } from './apoio/usuario';

let canal: CanalFalso;
let email: EmailFalso;
let alertados: { nivel: string; mensagem: string; setorId?: string | null; usuarioId?: string | null }[];

let fila: FilaFalsa;

function deps(): DepsTarefas {
  return {
    repos, canal, email, fila, relogio: () => new Date(),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    alertas: { alertar: async (a) => { alertados.push(a); } },
  };
}

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  email = new EmailFalso();
  fila = new FilaFalsa();
  alertados = [];
});

describe('batimento', () => {
  it('registra sinais de vida com o WhatsApp conectado', async () => {
    await batimento(deps());
    const s = await repos.sinaisVida();
    expect(Object.keys(s).sort()).toEqual(['fila', 'whatsapp']);
  });
  it('reenfileira resposta do painel pendente há mais de 2 minutos', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const { data: m } = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente', tipo: 'texto',
      conteudo: 'Segue', status_envio: 'pendente', criado_em: new Date(Date.now() - 5 * 60_000).toISOString() }).select().single();
    await batimento(deps());
    expect(fila.enviados).toEqual([{ nome: 'enviar-mensagem', dados: { mensagemId: m!.id }, opcoes: { singletonKey: m!.id } }]);
  });
  it('reenfileira perguntas ao assistente paradas há mais de 2 minutos, uma vez por pessoa e contexto (revisão final, E3)', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-tarefas.local', permissoes: ['assistente_site', 'assistente_whatsapp'], telefone: '5531988887777' });
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const ha = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    const pergunta = (canal: 'site' | 'whatsapp', conteudo: string, criado_em: string, extra: object = {}) =>
      db.from('assistente_mensagens').insert({ usuario_id: dono, canal, papel: 'usuario', conteudo, criado_em, ...extra }).then((r) => expect(r.error).toBeNull());
    await pergunta('whatsapp', 'a', ha(6));
    await pergunta('whatsapp', 'b', ha(5));
    await pergunta('site', 'c', ha(4), { conversa_id: conversa.id });
    await pergunta('site', 'recente', ha(0));
    await pergunta('site', 'respondida', ha(6), { processada_em: ha(5) });
    await batimento(deps());
    expect(fila.enviados.filter((e) => e.nome === 'assistente').map((e) => e.dados)).toEqual([
      { usuarioId: dono, canal: 'whatsapp', conversaId: null, telefone: '5531988887777' },
      { usuarioId: dono, canal: 'site', conversaId: conversa.id, telefone: null },
    ]);
  });
  it('WhatsApp desconectado gera um único alerta crítico em 30 minutos', async () => {
    canal.conectado = false;
    const d = { ...deps(), alertas: { alertar: async (a: { nivel: 'critico' | 'operacional' | 'aviso'; mensagem: string }) => { alertados.push(a); await repos.registrarAlerta(a); } } };
    await batimento(d);
    await batimento(d);
    expect(alertados).toEqual([{ nivel: 'critico', mensagem: MSG_WHATSAPP_DESCONECTADO }]);
    expect((await repos.sinaisVida()).whatsapp).toBeUndefined();
  });
});

describe('alertaFila', () => {
  it('avisa o setor sobre chamado sem responsável além do limite, uma vez', async () => {
    await db.from('configuracoes').update({ minutos_alerta_fila: 5 }).eq('id', 1);
    const fiscal = await setorId('Fiscal');
    await db.from('chamados').insert({ setor_id: fiscal, titulo: 'Guia DAS', criado_em: new Date(Date.now() - 10 * 60_000).toISOString() });
    await db.from('chamados').insert({ setor_id: fiscal, titulo: 'Recente' });
    expect(await alertaFila(deps())).toBe(1);
    expect(await alertaFila(deps())).toBe(0);
    expect(alertados[0]).toMatchObject({ nivel: 'aviso', setorId: fiscal });
    expect(alertados[0]!.mensagem).toMatch(/^Demanda #\d+ "Guia DAS" está sem responsável há mais de 5 minutos\.$/);
  });
});

describe('alertaVencimento', () => {
  const ontem = () => new Date(Date.now() - 24 * 3600_000).toISOString();
  async function demanda(titulo: string, extra: object = {}) {
    const fiscal = await setorId('Fiscal');
    const { data } = await db.from('chamados').insert({ setor_id: fiscal, titulo, prazo_em: ontem(), ...extra }).select('id, numero').single();
    return { id: data!.id, numero: Number(data!.numero), fiscal };
  }

  it('avisa o responsável, ou o setor sem responsável, uma vez por prazo; pausada e concluída não vencem', async () => {
    const ana = await criarUsuarioTeste({ email: 'ana@teste-vencimento.local', nome: 'Ana', papel: 'atendente', setores: ['Fiscal'] });
    const comAna = await demanda('Guia DAS', { responsavel_id: ana });
    const semNinguem = await demanda('Certidão');
    await demanda('Pausada', { status: 'aguardando_cliente' });
    await demanda('Concluída', { status: 'concluido' });
    await db.from('chamados').insert({ setor_id: comAna.fiscal, titulo: 'No prazo' });
    expect(await alertaVencimento(deps())).toBe(2);
    expect(alertados).toEqual(expect.arrayContaining([
      { nivel: 'aviso', usuarioId: ana, setorId: null, mensagem: `Demanda #${comAna.numero} "Guia DAS" venceu o prazo.` },
      { nivel: 'aviso', usuarioId: null, setorId: comAna.fiscal, mensagem: `Demanda #${semNinguem.numero} "Certidão" venceu o prazo.` },
    ]));
    expect(await alertaVencimento(deps())).toBe(0);
  });

  it('prazo novo libera um aviso novo', async () => {
    const d = await demanda('Guia DAS');
    expect(await alertaVencimento(deps())).toBe(1);
    await db.from('chamados').update({ prazo_em: new Date(Date.now() - 3600_000).toISOString() }).eq('id', d.id);
    expect(await alertaVencimento(deps())).toBe(1);
  });

  it('responsável arquivado: o aviso vai para o setor', async () => {
    const ze = await criarUsuarioTeste({ email: 'ze@teste-vencimento.local', nome: 'Zé', papel: 'atendente', setores: ['Fiscal'] });
    const d = await demanda('Guia DAS', { responsavel_id: ze });
    await db.from('usuarios').update({ ativo: false }).eq('id', ze);
    await alertaVencimento(deps());
    expect(alertados).toEqual([{ nivel: 'aviso', usuarioId: null, setorId: d.fiscal, mensagem: `Demanda #${d.numero} "Guia DAS" venceu o prazo.` }]);
  });
});

describe('resumo diário', () => {
  it('início do dia é meia-noite em São Paulo', () => {
    expect(inicioDoDiaSP(new Date('2026-09-28T02:00:00Z')).toISOString()).toBe('2026-09-27T03:00:00.000Z');
  });
  it('monta o texto do resumo', () => {
    expect(montarResumo({ abertosPorSetor: [{ setor: 'Fiscal', total: 3 }], concluidosHoje: 5, semResponsavel: 1 }))
      .toBe('📋 Resumo do dia\nConcluídos hoje: 5\nSem responsável: 1\nAbertos por setor:\n• Fiscal: 3');
  });
  it('envia por WhatsApp ao dono e por e-mail', async () => {
    await db.from('configuracoes').update({ email_alertas: 'dono@escritorio.com', telefone_dono: '5531977770000' }).eq('id', 1);
    await resumoDiario(deps());
    expect(canal.enviados[0]?.telefone).toBe('5531977770000');
    expect(email.enviados[0]?.assunto).toBe('Resumo do dia');
  });
});
