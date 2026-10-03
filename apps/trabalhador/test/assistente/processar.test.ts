import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { MENSAGEM_FORA_DO_HORARIO, MENSAGEM_TETO, processarAssistente } from '../../src/assistente/processar';
import { CanalFalso } from '../../src/canal/falso';
import { db, repos } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { criarUsuarioTeste } from '../apoio/usuario';

let canal: CanalFalso;
let dono: string;
beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  dono = await criarUsuarioTeste({ email: 'dono@teste-assistente.local', permissoes: ['assistente_site', 'assistente_whatsapp'], telefone: '5531988887777' });
});
const perguntar = (texto: string, canalAssistente: 'site' | 'whatsapp' = 'site') =>
  repos.registrarMensagemAssistente({ usuarioId: dono, canal: canalAssistente, conversaId: null, papel: 'usuario', conteudo: texto });

describe('processarAssistente (pedido do dono, 2026-09-29)', () => {
  it('site: responde uma vez às perguntas pendentes e grava a resposta', async () => {
    await perguntar('oi');
    await perguntar('tudo certo?');
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Tudo certo por aqui!' } }), fim()]);
    expect(await processarAssistente({ repos, ia, canal }, { usuarioId: dono, canal: 'site', conversaId: null, telefone: null }, true)).toBe('respondido');
    const h = await repos.historicoAssistente(dono, 'site', null, 10);
    expect(h.map((m) => `${m.papel}:${m.conteudo}`)).toEqual(['usuario:oi', 'usuario:tudo certo?', 'assistente:Tudo certo por aqui!']);
    expect(await repos.perguntasPendentes(dono, 'site', null)).toEqual([]);
    expect(canal.enviados).toEqual([]);
    // As duas perguntas foram juntas numa única mensagem do usuário.
    expect(ia.recebidos[0]!.messages).toEqual([{ role: 'user', content: 'oi\n\ntudo certo?' }]);
  });

  it('WhatsApp: também envia a resposta pelo WhatsApp', async () => {
    await perguntar('oi', 'whatsapp');
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi, Dono!' } }), fim()]);
    await processarAssistente({ repos, ia, canal }, { usuarioId: dono, canal: 'whatsapp', conversaId: null, telefone: '553188887777' }, true);
    expect(canal.enviados).toEqual([{ telefone: '553188887777', texto: 'Oi, Dono!' }]);
  });

  it('sem a marcação do canal não responde e não chama a IA', async () => {
    await db.from('usuarios').update({ permissoes: [] }).eq('id', dono);
    await perguntar('oi');
    const ia = new IaRoteirizada([]);
    expect(await processarAssistente({ repos, ia, canal }, { usuarioId: dono, canal: 'site', conversaId: null, telefone: null }, true)).toBe('sem-permissao');
    expect(ia.recebidos).toHaveLength(0);
    expect(await repos.perguntasPendentes(dono, 'site', null)).toEqual([]);
  });

  it('teto de gasto atingido: avisa sem chamar a IA', async () => {
    await db.from('configuracoes').update({ teto_ia_usd: 0 }).eq('id', 1);
    await perguntar('oi');
    const ia = new IaRoteirizada([]);
    expect(await processarAssistente({ repos, ia, canal }, { usuarioId: dono, canal: 'site', conversaId: null, telefone: null }, true)).toBe('teto');
    expect((await repos.historicoAssistente(dono, 'site', null, 5)).at(-1)!.conteudo).toBe(MENSAGEM_TETO);
  });

  it('falha da IA na última tentativa: responde que não conseguiu', async () => {
    await perguntar('oi');
    const ia = new IaRoteirizada([new Error('fora do ar')]);
    await processarAssistente({ repos, ia, canal }, { usuarioId: dono, canal: 'site', conversaId: null, telefone: null }, true);
    expect((await repos.historicoAssistente(dono, 'site', null, 5)).at(-1)!.conteudo).toContain('Não consegui responder agora');
  });

  it('falha da IA antes da última tentativa: repassa o erro para a fila tentar de novo', async () => {
    await perguntar('oi');
    const ia = new IaRoteirizada([new Error('fora do ar')]);
    await expect(processarAssistente({ repos, ia, canal }, { usuarioId: dono, canal: 'site', conversaId: null, telefone: null }, false)).rejects.toThrow('fora do ar');
    expect(await repos.perguntasPendentes(dono, 'site', null)).toHaveLength(1);
  });

  it('fora do horário: avisa pelo WhatsApp e não chama a IA (P17)', async () => {
    const ana = await criarUsuarioTeste({ email: 'ana@teste-horario.local', papel: 'atendente', permissoes: ['assistente_whatsapp'], telefone: '5531922220001' });
    await db.from('usuarios').update({ horario_acesso: { semana: null, sabado: null, domingo: null } }).eq('id', ana);
    await repos.registrarMensagemAssistente({ usuarioId: ana, canal: 'whatsapp', conversaId: null, papel: 'usuario', conteudo: 'quais notas?' });
    const ia = new IaRoteirizada([]);
    expect(await processarAssistente({ repos, ia, canal }, { usuarioId: ana, canal: 'whatsapp', conversaId: null, telefone: '5531922220001' }, true))
      .toBe('fora-do-horario');
    expect(ia.recebidos).toEqual([]);
    expect(canal.enviados).toEqual([{ telefone: '5531922220001', texto: MENSAGEM_FORA_DO_HORARIO }]);
    expect(await repos.perguntasPendentes(ana, 'whatsapp', null)).toEqual([]);
  });

  it('administrador com horário bloqueado é respondido normalmente', async () => {
    await db.from('usuarios').update({ horario_acesso: { semana: null, sabado: null, domingo: null } }).eq('id', dono);
    await perguntar('oi');
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi!' } }), fim()]);
    expect(await processarAssistente({ repos, ia, canal }, { usuarioId: dono, canal: 'site', conversaId: null, telefone: null }, true)).toBe('respondido');
  });
});
