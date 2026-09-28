import type { Db } from '@escritorio/db';
import type { ArmazenamentoMidia } from './midia/armazenamento';

const LOTE = 500;

/** Conversas, anexos e decisões do agente ficam guardados por 1 ano (spec, seção 9). */
export async function limparRetencao(db: Db, midia: ArmazenamentoMidia, agora = new Date()) {
  const limite = new Date(agora);
  limite.setFullYear(limite.getFullYear() - 1);
  const corte = limite.toISOString();
  let mensagens = 0;
  let arquivos = 0;
  for (;;) {
    const { data, error } = await db.from('mensagens').select('id, arquivo_path').lt('criado_em', corte).limit(LOTE);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    const paths = data.map((m) => m.arquivo_path).filter((p): p is string => Boolean(p));
    await midia.remover(paths);
    const { error: e2 } = await db.from('mensagens').delete().in('id', data.map((m) => m.id));
    if (e2) throw new Error(e2.message);
    mensagens += data.length;
    arquivos += paths.length;
  }
  const { data: decisoes, error: e3 } = await db.from('decisoes_agente').delete().lt('criado_em', corte).select('id');
  if (e3) throw new Error(e3.message);
  return { mensagens, arquivos, decisoes: decisoes?.length ?? 0 };
}
