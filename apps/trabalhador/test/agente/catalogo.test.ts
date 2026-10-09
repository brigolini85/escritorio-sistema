import { describe, expect, it } from 'vitest';
import { CATALOGO_PEDIDOS, secaoCatalogo } from '../../src/agente/catalogo';
import { montarSistema } from '../../src/agente/prompt';

// Atendimento rápido (opção A do desenho do catálogo): o catálogo revisado pelo dono entra no prompt como guia, sem banco.
describe('catálogo de pedidos no prompt do Thiago', () => {
  const secao = secaoCatalogo();

  it('tem os 75 tipos revisados pelo dono, cada um com o setor', () => {
    expect(CATALOGO_PEDIDOS).toHaveLength(75);
    for (const t of CATALOGO_PEDIDOS) {
      expect(secao).toContain(`- ${t.nome} → ${t.setor ?? 'setor mais próximo ou "triagem"'}`);
    }
  });

  it('pergunta só o obrigatório; o opcional vem entre colchetes', () => {
    const ferias = secao.split('\n').find((l) => l.startsWith('- Férias de funcionário'))!;
    expect(ferias).toContain('Qual funcionário? A partir de que dia? Quantos dias? (30 ou dividido)');
    expect(ferias).toContain('[se couber: Ele quer vender parte das férias?]');
  });

  it('marca a prioridade só quando não é a normal', () => {
    expect(secao).toContain('- Correção de nota já emitida → Fiscal (urgente):');
    expect(secao).toContain('- Demissão / rescisão → Pessoal (alta):');
    expect(secao).toMatch(/- Holerite \/ contracheque → Pessoal: /);
  });

  it('nota fiscal, documento da empresa, cliente novo e "outro" apontam para os fluxos próprios', () => {
    expect(secao).toContain('- Pedido de nota fiscal (venda ou devolução) → Fiscal: siga a regra 3a');
    expect(secao).toContain('- Documento da empresa (contrato social, cartão CNPJ) → Legalização: siga a regra 3b');
    expect(secao).toMatch(/- Possível novo cliente → Comercial \(alta\): siga a regra 8/);
    expect(secao).toContain('- Outro / não está no catálogo → setor mais próximo ou "triagem"');
  });

  it('não leva exemplos nem observações internas da equipe (tamanho contido)', () => {
    expect(secao).not.toContain('Confirmar com o dono');
    expect(secao).not.toContain('Faz uma nota pro mercado do centro');
    expect(secao.length).toBeLessThan(12000);
  });

  it('entra no bloco com cache, depois das regras e antes dos setores', () => {
    const s = montarSistema([{ id: 'S1', nome: 'Fiscal', descricao_assuntos: 'guias' }], []);
    expect(s.indexOf('CATÁLOGO DE PEDIDOS (guia')).toBeGreaterThan(s.indexOf('14. Prioridade'));
    expect(s.indexOf('CATÁLOGO DE PEDIDOS (guia')).toBeLessThan(s.indexOf('SETORES:'));
    // Auditoria 1.1, 1.2 e 5.1 (Tasks 2, 4 e 5): as regras de pagamento e de confirmação do cliente subiram o prompt fixo.
    expect(s.length).toBeLessThan(34000);
  });
});
