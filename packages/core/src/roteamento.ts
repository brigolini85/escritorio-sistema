export function escolherResponsavel(
  setorId: string | null,
  responsaveis: { setorId: string; usuarioId: string }[],
): string | null {
  if (!setorId) return null;
  return responsaveis.find((r) => r.setorId === setorId)?.usuarioId ?? null;
}
