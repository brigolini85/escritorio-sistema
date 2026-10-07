/** Prontidão (D2): fora da produção o trabalhador barra o envio e grava o id "bloqueado-…"; a tela não pode dizer "enviada". */
export function envioBloqueado(idProvedor: string | null | undefined): boolean {
  return (idProvedor ?? '').startsWith('bloqueado-');
}
