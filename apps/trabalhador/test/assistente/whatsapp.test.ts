import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { processarConversa, type DepsProcessamento } from '../../src/processar-conversa';
import { db, repos } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';
import { IaRoteirizada } from '../apoio/ia-roteirizada';
import { criarUsuarioTeste } from '../apoio/usuario';

let fila: FilaFalsa;
let ia: IaRoteirizada;
function deps(): DepsProcessamento {
  const canal = new CanalFalso();
  return {
    repos, ia, fila, envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) }, midia: criarArmazenamento(db),
    transcritor: { transcrever: vi.fn().mockResolvedValue('gera o csv') }, alertas: { alertar: async () => {} }, relogio: () => new Date('2026-09-29T15:00:00Z'),
  };
}
async function mensagemDe(telefone: string, conteudo: string) {
  const conversa = await repos.obterOuCriarConversa(telefone, null);
  await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: `T-${Math.random()}`, tipo: 'texto', conteudo });
  return conversa.id;
}

beforeEach(async () => {
  await limparBanco();
  fila = new FilaFalsa();
  ia = new IaRoteirizada([]);
});

describe('WhatsApp da equipe e o assistente (pedido do dono, 2026-09-29)', () => {
  it('usuário com assistente pelo WhatsApp (número sem o 9): vira pergunta ao assistente e agenda a fila', async () => {
    const dono = await criarUsuarioTeste({ email: 'dono@teste-wpp.local', permissoes: ['assistente_whatsapp'], telefone: '5531988887777' });
    const conversaId = await mensagemDe('553188887777', 'quais notas estão abertas?');
    expect(await processarConversa(deps(), conversaId, true)).toBe('assistente');
    expect((await repos.perguntasPendentes(dono, 'whatsapp', null)).map((m) => m.conteudo)).toEqual(['quais notas estão abertas?']);
    expect(fila.enviados).toEqual([{ nome: 'assistente', dados: { usuarioId: dono, canal: 'whatsapp', conversaId: null, telefone: '553188887777' }, opcoes: expect.any(Object) }]);
    expect(await repos.mensagensNaoProcessadas(conversaId)).toEqual([]);
    expect(ia.recebidos).toHaveLength(0);   // o agente de clientes não responde
  });

  it('falha ao agendar o assistente: a mensagem continua pendente para a nova tentativa (revisão final, E2)', async () => {
    await criarUsuarioTeste({ email: 'dono@teste-wpp.local', permissoes: ['assistente_whatsapp'], telefone: '5531988887777' });
    const conversaId = await mensagemDe('553188887777', 'quais notas estão abertas?');
    fila.enviar = async () => { throw new Error('fila fora do ar'); };
    await expect(processarConversa(deps(), conversaId, false)).rejects.toThrow('fila fora do ar');
    expect((await repos.mensagensNaoProcessadas(conversaId)).map((m) => m.conteudo)).toEqual(['quais notas estão abertas?']);
  });

  it('usuário sem a marcação segue ignorado como telefone interno; arquivado deixa de ser interno (painel v2, parte B)', async () => {
    const id = await criarUsuarioTeste({ email: 'ana@teste-wpp.local', permissoes: ['assistente_site'], telefone: '5531977776666' });
    expect(await processarConversa(deps(), await mensagemDe('5531977776666', 'oi'), true)).toBe('interno');
    expect(fila.enviados).toEqual([]);
    await db.from('usuarios').update({ permissoes: ['assistente_whatsapp'], ativo: false }).eq('id', id);
    // Arquivado: o telefone deixa de ser interno e a conversa cai no fluxo normal (contato desconhecido).
    expect(await processarConversa(deps(), await mensagemDe('5531977776666', 'oi de novo'), true)).not.toBe('interno');
  });
});
