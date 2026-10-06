import type { Repos } from '@escritorio/db';
import type { RemoverArquivos } from './armazenamento';

/** Parte I3b (D14): apaga do compartimento "tarefas" os arquivos vencidos pela guarda que o dono escolheu ("nunca" = nada vence). */
export async function limparArquivosDasTarefas(
  repos: Pick<Repos, 'arquivosVencidosDasTarefas' | 'marcarArquivosRemovidos'>, remover: RemoverArquivos,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const lote = await repos.arquivosVencidosDasTarefas(200);
    if (!lote || lote.length === 0) break;
    // Primeiro o Storage: se falhar, nada é marcado e a limpeza de amanhã tenta de novo.
    await remover(lote.map((a) => a.caminho));
    total += await repos.marcarArquivosRemovidos(lote.map((a) => a.id));
  }
  return total;
}
