import { describe, expect, it } from 'vitest';
import { CASOS_RETRATO, retratoDoPedido } from '../apoio/retrato';

// Parte I1, Task 1 (D2): o pedido do Thiago tirado ANTES do motor. Nenhuma task depois desta regrava estes arquivos;
// o motor tem de produzir o mesmo pedido (motor-thiago.test.ts). Arquivo diferente = comportamento diferente.
describe('retrato do pedido do Thiago', () => {
  for (const [nome, ctx] of Object.entries(CASOS_RETRATO)) {
    it(nome, async () => {
      await expect(await retratoDoPedido(ctx())).toMatchFileSnapshot(`./__retratos__/${nome}.json`);
    });
  }

  it('o retrato tem o que se espera do Thiago (conferência de sanidade)', async () => {
    const pedido = JSON.parse(await retratoDoPedido(CASOS_RETRATO['contato-uma-empresa']!()));
    expect(Object.keys(pedido)).toEqual(['model', 'max_tokens', 'system', 'tools', 'messages', 'output_config']);
    expect(pedido.tools.map((t: { name: string }) => t.name)).toEqual([
      'selecionar_empresa', 'abrir_chamado', 'consultar_chamados', 'sinalizar_nao_entendido', 'passar_para_pessoa', 'buscar_parceiros',
      'buscar_produtos', 'resumir_pedido_nota', 'abrir_pedido_nota', 'listar_documentos', 'enviar_documento', 'consultar_cadastro',
      'consultar_preco', 'alterar_preco', 'cadastrar_produto', 'responder',
    ]);
    expect(pedido.system[0].text).toContain('Seu nome é Thiago.');
    expect(pedido.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });
});
