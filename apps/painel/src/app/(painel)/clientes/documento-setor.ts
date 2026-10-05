/** Setor e "Tem valores" de um documento, do formulário (D11). null = o formulário não tem o campo (banco sem a H2). */
export function lerSetorDoDocumento(f: FormData, setoresValidos: string[]): { setor_id: string | null; tem_valores: boolean } | { erro: string } | null {
  if (!f.has('setor_id')) return null;
  const setor = String(f.get('setor_id') ?? '');
  if (setor && !setoresValidos.includes(setor)) return { erro: 'Escolha um setor da lista.' };
  return { setor_id: setor || null, tem_valores: f.get('tem_valores') === 'on' };
}
