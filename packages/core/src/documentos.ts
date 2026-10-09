export function somenteDigitos(s: string): string {
  return s.replace(/\D/g, '');
}

export function validarCnpj(entrada: string): boolean {
  const c = somenteDigitos(entrada);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const digito = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce((s, d, i) => s + Number(d) * pesos[i]!, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(c.slice(0, 12));
  const d2 = digito(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`);
}

/**
 * Auditoria 1.3 e 6.10: o arquivo do documento fica na pasta da própria empresa (clientes/<cliente_id>/), sem "..".
 * O banco já confere (caminho_da_empresa); o trabalhador antes de enviar e o painel antes de apagar conferem de novo.
 */
export function caminhoDaEmpresa(clienteId: string, caminho: string): boolean {
  return clienteId.length > 0 && caminho.startsWith(`clientes/${clienteId}/`) && !caminho.includes('..');
}
