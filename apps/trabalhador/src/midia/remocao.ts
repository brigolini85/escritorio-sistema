/**
 * Fila "remover-arquivos": os caminhos vêm de anonimizar_contato (LGPD) e de outros pontos que só conhecem anexos.
 * Revisão geral I5: o retorno da LGPD também traz arquivos do compartimento "tarefas". O formato separa:
 * "conversas/..." é de "anexos"; o resto ("<tarefa>/<arquivo>") é de "tarefas".
 */
export type RemoverPorCompartimento = { anexos: (paths: string[]) => Promise<void>; tarefas: (paths: string[]) => Promise<void> };

export async function removerArquivosDoJob(paths: string[], remover: RemoverPorCompartimento): Promise<void> {
  const anexos = paths.filter((p) => p.startsWith('conversas/'));
  const tarefas = paths.filter((p) => !p.startsWith('conversas/'));
  if (anexos.length) await remover.anexos(anexos);
  if (tarefas.length) await remover.tarefas(tarefas);
}
