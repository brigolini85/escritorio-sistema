import { describe, expect, it } from 'vitest';
import { destinoDoPedido } from './destino';

describe('destinoDoPedido', () => {
  it('envio feito (ou e-mail desconhecido, que o Supabase aceita igual) mostra o aviso genérico', () => {
    expect(destinoDoPedido(false)).toBe('/esqueci-senha?enviado=1');
  });
  it('falha de envio volta com erro=envio', () => {
    expect(destinoDoPedido(true)).toBe('/esqueci-senha?erro=envio');
  });
});
