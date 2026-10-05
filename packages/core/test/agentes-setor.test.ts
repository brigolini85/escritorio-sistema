import { describe, expect, it } from 'vitest';
import {
  APROVACAO_FERRAMENTA, CATALOGO_COMPLETO, FERRAMENTAS_ATENDIMENTO, FERRAMENTAS_DO_CATALOGO, FERRAMENTAS_SETOR, FERRAMENTAS_SO_ATENDIMENTO,
  ROTULO_APROVACAO, apresentacaoDoSetor, ferramentasDoEspecialista, modoParaAssunto,
} from '../src';

describe('catálogo do setor (D12)', () => {
  it('as 16 do Thiago continuam as mesmas; as 4 do setor vêm depois', () => {
    expect(FERRAMENTAS_ATENDIMENTO).toHaveLength(16);
    expect(FERRAMENTAS_SETOR).toEqual(['ler_demandas_setor', 'conferir_pedido_nota', 'nota_interna', 'sugerir_correcao']);
    expect(FERRAMENTAS_DO_CATALOGO).toEqual([...FERRAMENTAS_ATENDIMENTO, ...FERRAMENTAS_SETOR]);
    expect(CATALOGO_COMPLETO.conferir_pedido_nota.efeito).toBe('leitura');
    expect(CATALOGO_COMPLETO.nota_interna.efeito).toBe('grava');
  });
  it('toda ferramenta tem classe de aprovação; só leitura não tem (D8)', () => {
    for (const f of FERRAMENTAS_DO_CATALOGO) {
      expect(f in APROVACAO_FERRAMENTA).toBe(true);
      expect(APROVACAO_FERRAMENTA[f] === null).toBe(CATALOGO_COMPLETO[f].efeito === 'leitura');
    }
    expect(FERRAMENTAS_SO_ATENDIMENTO).toEqual(['selecionar_empresa', 'abrir_chamado', 'sinalizar_nao_entendido', 'passar_para_pessoa', 'enviar_documento']);
    expect(ROTULO_APROVACAO.pessoa).toBe('aprovação de uma pessoa do setor');
  });
});

describe('ferramentas do agente do setor por modo (D4, D8)', () => {
  const todas = [...FERRAMENTAS_DO_CATALOGO, 'apagar_tudo'];
  it('nunca as "só do Thiago" nem responder (entra pelo modo); fora do catálogo some', () => {
    const r = ferramentasDoEspecialista(todas, 'mesma_voz');
    for (const f of [...FERRAMENTAS_SO_ATENDIMENTO, 'responder', 'apagar_tudo']) expect(r).not.toContain(f);
    expect(r).toEqual(expect.arrayContaining(['resumir_pedido_nota', 'abrir_pedido_nota', 'nota_interna', 'conferir_pedido_nota']));
  });
  it('por trás: nada que envia ou dependa do "sim" do cliente', () => {
    expect(ferramentasDoEspecialista(todas, 'por_tras')).toEqual(['consultar_chamados', 'buscar_parceiros', 'buscar_produtos', 'listar_documentos',
      'consultar_cadastro', 'consultar_preco', 'ler_demandas_setor', 'conferir_pedido_nota', 'nota_interna', 'sugerir_correcao']);
  });
  it('só as escolhidas, na ordem do catálogo', () => {
    expect(ferramentasDoEspecialista(['nota_interna', 'consultar_chamados'], 'passa_conversa')).toEqual(['consultar_chamados', 'nota_interna']);
  });
});

describe('regra por assunto (D3)', () => {
  const regras = [
    { id: 'r1', assunto: 'Pedido de nota de venda', exemplo: '', modo: 'mesma_voz' as const },
    { id: 'r2', assunto: 'Dúvida sobre imposto', exemplo: '', modo: 'passa_conversa' as const },
  ];
  it('o assunto da lista (sem acento, maiúscula ou espaço a mais) dá o modo da regra', () => {
    expect(modoParaAssunto(regras, '  duvida   SOBRE imposto ', 'por_tras')).toEqual({ modo: 'passa_conversa', regraId: 'r2' });
  });
  it('"outro" ou assunto sem regra: o modo padrão, sem regra', () => {
    expect(modoParaAssunto(regras, 'outro', 'por_tras')).toEqual({ modo: 'por_tras', regraId: null });
    expect(modoParaAssunto(regras, 'Certidão', 'mesma_voz')).toEqual({ modo: 'mesma_voz', regraId: null });
  });
  it('a apresentação do Passa a conversa', () => {
    expect(apresentacaoDoSetor('Fiscal')).toBe('Aqui é do Fiscal do escritório');
  });
});
