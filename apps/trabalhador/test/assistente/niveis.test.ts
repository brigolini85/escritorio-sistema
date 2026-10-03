import { NIVEIS_PADRAO, type Niveis } from '@escritorio/core';
import type { UsuarioAssistente } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import { beforeEach, describe, expect, it } from 'vitest';
import { podeCorrigirPedidos, podeVerChamado, podeVerConversaPelo, podeVerPedidos, usaAssistentePor } from '../../src/assistente/visibilidade';
import { db, repos } from '../apoio/cenario';
import { criarUsuarioTeste } from '../apoio/usuario';

const pessoa = (n: Partial<Niveis>, papel: 'admin' | 'atendente' = 'atendente'): UsuarioAssistente =>
  ({ id: 'u1', nome: 'Ana', papel, telefone: null, ativo: true, setores: ['s1'], niveis: { ...NIVEIS_PADRAO, ...n } });

describe('assistente pelos níveis (Parte D)', () => {
  it('pedidos de nota: Ver lê, Corrigir e gerar corrige; Sem acesso não lê (P11)', () => {
    expect(podeVerPedidos(pessoa({ notas: 'ver' }))).toBe(true);
    expect(podeCorrigirPedidos(pessoa({ notas: 'ver' }))).toBe(false);
    expect(podeVerPedidos(pessoa({ notas: 'sem_acesso' }))).toBe(false);
    expect(podeCorrigirPedidos(pessoa({ notas: 'corrigir' }))).toBe(true);
    expect(podeCorrigirPedidos(pessoa({ notas: 'sem_acesso' }, 'admin'))).toBe(true);
  });

  it('canal do assistente: sem passe livre do administrador (P3)', () => {
    expect(usaAssistentePor(pessoa({ assistente: 'site' }), 'site')).toBe(true);
    expect(usaAssistentePor(pessoa({ assistente: 'site' }), 'whatsapp')).toBe(false);
    expect(usaAssistentePor(pessoa({ assistente: 'site_whatsapp' }), 'whatsapp')).toBe(true);
    expect(usaAssistentePor(pessoa({}, 'admin'), 'site')).toBe(false);
  });
});

describe('a regra do trabalhador é a do banco, pessoa a pessoa (foco da revisão 5)', () => {
  beforeEach(async () => { await limparBanco(); });

  it('demandas e conversas, em cada nível', async () => {
    const setor = async (nome: string) => (await db.from('setores').select('id').eq('nome', nome).single()).data!.id as string;
    const [fiscal, pessoal] = [await setor('Fiscal'), await setor('Pessoal')];
    const criar = (email: string, papel: 'admin' | 'atendente', setores: string[]) =>
      criarUsuarioTeste({ email: `${email}@niveis-assistente.local`, papel, setores, permissoes: [] });
    const p = {
      admin: await criar('admin', 'admin', []),
      minhas: await criar('minhas', 'atendente', ['Fiscal']),
      setor: await criar('setor', 'atendente', ['Fiscal']),
      todas: await criar('todas', 'atendente', ['Fiscal']),
      semAtendimento: await criar('sem', 'atendente', ['Fiscal']),
      todasConversas: await criar('tc', 'atendente', ['Pessoal']),
      arquivada: await criar('arq', 'atendente', ['Fiscal']),
      // Colega com o assistente pelo WhatsApp: a conversa dele é interna e fica fora de "Todas as conversas" (ruling da Task 3).
      interno: await criarUsuarioTeste({ email: 'interno@niveis-assistente.local', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_whatsapp'], telefone: '5531999990009' }),
      // Telefone guardado, mas assistente só no site: a conversa desse número é de cliente, não interna.
      soSite: await criarUsuarioTeste({ email: 'sosite@niveis-assistente.local', papel: 'atendente', setores: ['Pessoal'], permissoes: ['assistente_site'], telefone: '5531999990008' }),
      // "Atendimento: Sem acesso" não lê nem a conversa que ele mesmo assumiu.
      semAtendimentoAssumiu: await criar('sem-assumiu', 'atendente', ['Fiscal']),
      adminArquivado: await criar('admin-arq', 'admin', []),
    };
    const nivel = (id: string, modulo: string, n: string) =>
      db.from('usuario_permissoes').update({ nivel: n }).eq('usuario_id', id).eq('modulo', modulo);
    await nivel(p.minhas, 'demandas', 'minhas');
    await nivel(p.todas, 'demandas', 'todas');
    await nivel(p.semAtendimento, 'atendimento', 'sem_acesso');
    await nivel(p.todasConversas, 'atendimento', 'todas');
    await nivel(p.semAtendimentoAssumiu, 'atendimento', 'sem_acesso');
    await db.from('usuarios').update({ ativo: false }).in('id', [p.arquivada, p.adminArquivado]);

    // Mesmas colunas em todas as linhas: no insert em lote, a coluna que falta vai como null (e estado não aceita null).
    const conversa = (telefone: string, atendente: string | null = null) =>
      ({ telefone, estado: atendente ? 'humano' as const : 'agente' as const, atendente_id: atendente });
    const conversas = (await db.from('conversas').insert([
      conversa('5531933330001'), conversa('5531933330002'), conversa('5531933330003', p.setor),
      conversa('553199990009'), conversa('553199990008'), conversa('5531933330004', p.semAtendimentoAssumiu),
    ]).select('id')).data!.map((c) => c.id);
    const demandas = (await db.from('chamados').insert([
      { titulo: 'N1 Fiscal', setor_id: fiscal, conversa_id: conversas[0] },
      { titulo: 'N2 Fiscal da Minhas', setor_id: fiscal, responsavel_id: p.minhas, conversa_id: conversas[1] },
      { titulo: 'N3 Pessoal', setor_id: pessoal },
      { titulo: 'N4 Triagem', setor_id: null },
    ]).select('id, setor_id, responsavel_id')).data!;

    for (const id of Object.values(p)) {
      const u = (await repos.obterUsuarioAssistente(id))!;
      for (const c of demandas) {
        const banco = (await db.rpc('pode_ver_chamado_de', { p_usuario: id, p_chamado: c.id })).data;
        expect(podeVerChamado(u, c), `${u.id} × demanda ${c.id}`).toBe(banco);
      }
      for (const conversaId of conversas) {
        const [conversa, daConversa] = await Promise.all([repos.obterConversa(conversaId), repos.chamadosDaConversaParaVisibilidade(conversaId)]);
        const interna = (await repos.usuarioDoAssistente(conversa.telefone)) !== null;
        const banco = (await db.rpc('pode_ver_conversa_de', { p_usuario: id, p_conversa: conversaId })).data;
        expect(podeVerConversaPelo(u, conversa, daConversa, interna), `${u.id} × conversa ${conversaId}`).toBe(banco);
      }
    }

    // Os casos de borda dão o resultado esperado (a comparação acima não pode passar por "todos false").
    const conversaVe = async (pessoaId: string, i: number) => (await db.rpc('pode_ver_conversa_de', { p_usuario: pessoaId, p_conversa: conversas[i]! })).data;
    expect(await conversaVe(p.todasConversas, 4)).toBe(true);
    expect(await conversaVe(p.todasConversas, 3)).toBe(false);
    expect(await conversaVe(p.semAtendimentoAssumiu, 5)).toBe(false);
    expect(await conversaVe(p.admin, 3)).toBe(true);
    expect(await conversaVe(p.adminArquivado, 0)).toBe(false);
  });
});
