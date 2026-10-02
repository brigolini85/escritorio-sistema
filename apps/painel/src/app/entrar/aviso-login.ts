/** Recado do administrador na tela de entrada: aparado, vazio vira nada, nunca passa de 200 caracteres. */
export function avisoParaMostrar(texto: string | null | undefined): string | null {
  const t = (texto ?? '').trim();
  return t ? t.slice(0, 200) : null;
}
