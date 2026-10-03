import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { executarAgente } from '../../src/agente/executar';
import { processarSimulacao } from '../../src/agente/simular';
import { processarAssistente } from '../../src/assistente/processar';
import { processarSugestao } from '../../src/sugestao/processar';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, db, repos, setorId } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { criarUsuarioTeste } from '../apoio/usuario';

// Prompt F: cada caminho que chama a IA grava a funcionalidade certa, a pessoa certa e a empresa certa.
const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;
const usos = async () =>
  (await db.from('uso_ia').select('funcionalidade, usuario_id, conversa_id, cliente_id, provedor').order('criado_em')).data!;
const envio = () => ({ repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) });

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
});
// Cada teste confere a funcionalidade exata de TODAS as linhas: nenhuma "nao_identificado" (registro novo assim é bug).

describe('uso_ia por caminho', () => {
  it('agente de clientes: agente_clientes, sem pessoa, com a conversa e a empresa em foco', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    const c = await repos.obterConversa(conversa.id);
    const ctx = await carregarContexto(repos, c, await repos.buscarContato(c.telefone), await repos.obterConfiguracoes(), SEGUNDA_10H);
    await executarAgente({ repos, ia, envio: envio() }, ctx, [{ type: 'text', text: 'oi' }]);
    const l = await usos();
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((u) => u.funcionalidade === 'agente_clientes' && u.usuario_id === null && u.conversa_id === conversa.id
      && u.cliente_id === empresas[0]!.id && u.provedor === 'anthropic')).toBe(true);
  });

  it('assistente pelo site: assistente_site, com a pessoa, sem conversa e sem empresa (mesmo aberto numa conversa)', async () => {
    const ana = await criarUsuarioTeste({ email: 'ana@gastos.local', permissoes: ['assistente_site'] });
    const { conversa } = await contatoComEmpresas(['Empresa Y'], '5531999990002');
    await repos.registrarMensagemAssistente({ usuarioId: ana, canal: 'site', conversaId: conversa.id, papel: 'usuario', conteudo: 'oi' });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'ok' } }), fim()]);
    await processarAssistente({ repos, ia, canal }, { usuarioId: ana, canal: 'site', conversaId: conversa.id, telefone: null }, true);
    // Duas chamadas à IA (a ferramenta e o fim): todas as linhas têm a mesma funcionalidade, pessoa, sem conversa e sem empresa.
    const l = await usos();
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((u) => u.funcionalidade === 'assistente_site' && u.usuario_id === ana && u.conversa_id === null && u.cliente_id === null)).toBe(true);
  });

  it('assistente pelo WhatsApp: assistente_whatsapp, com a pessoa', async () => {
    const ana = await criarUsuarioTeste({ email: 'ana2@gastos.local', permissoes: ['assistente_site', 'assistente_whatsapp'], telefone: '5531988887777' });
    await repos.registrarMensagemAssistente({ usuarioId: ana, canal: 'whatsapp', conversaId: null, papel: 'usuario', conteudo: 'oi' });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'ok' } }), fim()]);
    await processarAssistente({ repos, ia, canal }, { usuarioId: ana, canal: 'whatsapp', conversaId: null, telefone: '5531988887777' }, true);
    const l = await usos();
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((u) => u.funcionalidade === 'assistente_whatsapp' && u.usuario_id === ana && u.conversa_id === null && u.cliente_id === null)).toBe(true);
  });

  it('Sugerir resposta: sugerir_resposta, com a pessoa, a conversa e a empresa da conversa', async () => {
    const ana = await criarUsuarioTeste({ email: 'ana3@gastos.local', permissoes: ['assistente_site'], setores: ['Fiscal'] });
    const { conversa, empresas } = await contatoComEmpresas(['Empresa Z'], '5531999990003');
    await db.from('conversas').update({ cliente_em_foco: empresas[0]!.id }).eq('id', conversa.id);
    await repos.abrirChamado({ clienteId: empresas[0]!.id, conversaId: conversa.id, setorId: await setorId('Fiscal'), responsavelId: null,
      titulo: 'Guia', resumo: 'x', foraDoContrato: false, origem: 'agente' });
    const id = (await db.from('sugestoes_resposta').insert({ usuario_id: ana, conversa_id: conversa.id }).select('id').single()).data!.id;
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'entregar_rascunho', entrada: { texto: 'Bom dia!' } })]);
    await processarSugestao({ repos, ia, canal }, id, true);
    expect(await usos()).toEqual([expect.objectContaining({ funcionalidade: 'sugerir_resposta', usuario_id: ana, conversa_id: conversa.id, cliente_id: empresas[0]!.id })]);
  });

  // Revisão final (I1): a mesma regra de empresa em todo caminho (empresaDoUso): várias empresas sem foco não viram a primeira.
  it('agente de clientes com várias empresas e nenhuma em foco: sem empresa', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X', 'Comércio Y']);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    const c = await repos.obterConversa(conversa.id);
    const ctx = await carregarContexto(repos, c, await repos.buscarContato(c.telefone), await repos.obterConfiguracoes(), SEGUNDA_10H);
    await executarAgente({ repos, ia, envio: envio() }, ctx, [{ type: 'text', text: 'oi' }]);
    const l = await usos();
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((u) => u.funcionalidade === 'agente_clientes' && u.cliente_id === null)).toBe(true);
  });

  const sugerirSemFoco = async (nomes: string[], email: string, telefone: string) => {
    const ana = await criarUsuarioTeste({ email, permissoes: ['assistente_site'], setores: ['Fiscal'] });
    const { conversa, empresas } = await contatoComEmpresas(nomes, telefone);
    await repos.abrirChamado({ clienteId: empresas[0]!.id, conversaId: conversa.id, setorId: await setorId('Fiscal'), responsavelId: null,
      titulo: 'Guia', resumo: 'x', foraDoContrato: false, origem: 'agente' });
    const id = (await db.from('sugestoes_resposta').insert({ usuario_id: ana, conversa_id: conversa.id }).select('id').single()).data!.id;
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'entregar_rascunho', entrada: { texto: 'Bom dia!' } })]);
    await processarSugestao({ repos, ia, canal }, id, true);
    return { ana, conversa, empresas, ia };
  };

  it('Sugerir resposta com várias empresas e nenhuma em foco: sem empresa no gasto (o prompt continua igual)', async () => {
    const { ana, conversa, empresas, ia } = await sugerirSemFoco(['Empresa Z', 'Empresa W'], 'ana4@gastos.local', '5531999990005');
    expect(await usos()).toEqual([expect.objectContaining({ funcionalidade: 'sugerir_resposta', usuario_id: ana, conversa_id: conversa.id, cliente_id: null })]);
    // O texto do prompt não muda: continua citando a primeira empresa do contato, como antes.
    expect(JSON.stringify(ia.recebidos[0]!.system)).toContain(`id ${empresas[0]!.id}`);
  });

  it('Sugerir resposta com uma empresa só e nenhuma em foco: essa empresa', async () => {
    const { empresas } = await sugerirSemFoco(['Empresa Z'], 'ana5@gastos.local', '5531999990006');
    expect(await usos()).toEqual([expect.objectContaining({ funcionalidade: 'sugerir_resposta', cliente_id: empresas[0]!.id })]);
  });

  it('Testar o agente: testar_agente, com quem pediu, sem conversa e sem empresa (mesmo com empresa escolhida)', async () => {
    const thiago = await criarUsuarioTeste({ email: 'treino@gastos.local', permissoes: ['treinar_agente'] });
    const { empresas } = await contatoComEmpresas(['Empresa T'], '5531999990004');
    const id = (await db.from('simulacoes_agente').insert({ usuario_id: thiago, mensagem: 'oi', cliente_id: empresas[0]!.id, criado_em: new Date().toISOString() })
      .select('id').single()).data!.id;
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    await processarSimulacao({ repos, ia, envio: envio(), relogio: () => SEGUNDA_10H }, id, true);
    const l = await usos();
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((u) => u.funcionalidade === 'testar_agente' && u.usuario_id === thiago && u.conversa_id === null && u.cliente_id === null)).toBe(true);
  });
});
