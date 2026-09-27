export function normalizarTelefone(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return digitos;
  return null;
}

/** Celulares brasileiros podem chegar com ou sem o nono dígito; devolve as duas formas. */
export function variantesTelefone(t: string): string[] {
  if (t.length === 13 && t[4] === '9') return [t, t.slice(0, 4) + t.slice(5)];
  if (t.length === 12 && /[6-9]/.test(t[4] ?? '')) return [t, `${t.slice(0, 4)}9${t.slice(4)}`];
  return [t];
}
