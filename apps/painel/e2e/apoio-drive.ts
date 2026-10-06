import { sqlTeste } from '@escritorio/db/teste';
import { db } from './apoio';

/** Código de pasta do Drive só para os e2e (10 a 200 caracteres do alfabeto do Drive). */
export const PASTA_E2E = '1PastaE2ePadariaSolAbcdefgh';
export const ARQUIVO_DRIVE_E2E = '1ArqE2eAbcdefghijklm';

/**
 * Um arquivo do Drive já copiado para a tarefa, como o trabalhador deixaria (I3b, D4): o objeto vai ao compartimento "tarefas"
 * em <tarefa>/drive/ e a linha entra com origem 'drive' e o código do arquivo. Devolve o id da linha.
 */
export async function arquivoDoDrive(tarefaId: string, nome: string): Promise<string> {
  const caminho = `${tarefaId}/drive/1ArqE2e-${Date.now()}.pdf`;
  const bytes = new TextEncoder().encode('%PDF-1.4 arquivo do Drive de teste');
  const up = await db.storage.from('tarefas').upload(caminho, bytes, { contentType: 'application/pdf' });
  if (up.error) throw new Error(`arquivoDoDrive: ${up.error.message}`);
  const r = await sqlTeste<{ id: string }>(`insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho, lido_em, drive_id, drive_modificado_em)
    values ($1, 'drive', 'tarefas', $2, $3, 'application/pdf', $4, now(), $5, now()) returning id`,
  [tarefaId, caminho, nome, bytes.length, ARQUIVO_DRIVE_E2E]);
  return r[0]!.id;
}
