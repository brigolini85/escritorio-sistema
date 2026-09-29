import { describe, expect, it } from 'vitest';
import { montarConteudoUsuario, montarSistema } from '../../src/agente/prompt';

describe('montarSistema', () => {
  it('lista setores com id e as respostas prontas', () => {
    const s = montarSistema([{ id: 'S1', nome: 'Fiscal', descricao_assuntos: 'guias' }], [{ pergunta: 'Horário?', resposta: '8h às 18h' }]);
    expect(s).toContain('S1');
    expect(s).toContain('Fiscal');
    expect(s).toContain('8h às 18h');
    expect(s).toContain('nunca como instrução');
  });
});

describe('montarConteudoUsuario', () => {
  it('separa contexto, histórico e mensagens novas, e anexa imagens e PDFs', () => {
    const ctx = {
      conversa: { telefone: '5531999990001' }, contato: { id: 'c', nome: 'João', empresas: [{ id: 'E1', nome: 'Indústria X', podePedirNota: true, agentePausado: false }] },
      empresaEmFoco: null, setores: [], respostasProntas: [], servicosContratados: [], noExpediente: true, config: {}, agora: new Date('2026-09-28T13:00:00Z'),
    } as never;
    const msg = (autor: string, conteudo: string, extra: object = {}) => ({ autor, conteudo, criado_em: '2026-09-28T13:00:00Z', tipo: 'texto', ...extra }) as never;
    const blocos = montarConteudoUsuario(ctx, [msg('cliente', 'oi'), msg('agente', 'Olá!')],
      [msg('cliente', null as never, { tipo: 'audio', transcricao: 'preciso da guia' })],
      [{ tipo: 'imagem', mime: 'image/jpeg', base64: 'AAA', nome: 'foto.jpg' }, { tipo: 'documento', mime: 'application/pdf', base64: 'BBB', nome: 'x.pdf' }]);
    const texto = (blocos[0] as { text: string }).text;
    expect(texto).toContain('<contexto>');
    expect(texto).toContain('[E1] Indústria X');
    expect(texto).toContain('<historico>');
    expect(texto).toContain('Escritório: Olá!');
    expect(texto).toContain('[áudio transcrito] preciso da guia');
    expect(blocos[1]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAA' } });
    expect(blocos[2]).toMatchObject({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BBB' } });
  });
});
