import { describe, expect, it } from 'vitest';
import { CASOS_RETRATO_ASSISTENTE, retratoDoAssistente } from '../apoio/retrato-assistente';

// Parte I4, Task 1 (D1): o pedido do Assistente tirado ANTES da I4. Nenhuma task depois desta regrava estes arquivos;
// sem gatilho (D2) a I4 tem de produzir o mesmo pedido. Arquivo diferente = comportamento diferente.
describe('retrato do pedido do Assistente', () => {
  for (const [nome, caso] of Object.entries(CASOS_RETRATO_ASSISTENTE)) {
    it(nome, async () => {
      await expect(await retratoDoAssistente(caso())).toMatchFileSnapshot(`./__retratos_assistente__/${nome}.json`);
    });
  }

  it('o retrato tem o que se espera do Assistente (conferência de sanidade)', async () => {
    const pedido = JSON.parse(await retratoDoAssistente(CASOS_RETRATO_ASSISTENTE['admin-site-geral']!()));
    expect(Object.keys(pedido)).toEqual(['model', 'max_tokens', 'system', 'tools', 'messages', 'output_config']);
    expect(pedido.system).toHaveLength(1);
    expect(pedido.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(pedido.system[0].text).toContain('Você é o assistente interno do escritório de contabilidade.');
    expect(pedido.tools.map((t: { name: string }) => t.name)).toEqual([
      'listar_demandas', 'ver_demanda', 'buscar_empresas', 'buscar_parceiros', 'buscar_produtos', 'consultar_preco', 'dados_cadastro',
      'resumo_vendas', 'alterar_pedido_venda', 'gerar_csv_bling', 'responder',
    ]);
  });
});
