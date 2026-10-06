import { Archive, CircleCheck, FileWarning, Lock, LockKeyhole, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { tarefaAtiva } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { avisoDoDrive } from '@/lib/drive-tela';
import { ROTULO_ORIGEM, textoDoPedido } from '@/lib/tarefas-tela';
import type { TarefaTela } from '@/lib/tarefas-tela';
import { EnviarArquivo } from './enviar-arquivo';
import { LerPasta } from './ler-pasta';

export function FontesTarefa({ t, podeMexer }: { t: TarefaTela; podeMexer: boolean }) {
  const faltando = t.pendencias.filter((p) => p.tipo === 'cliente' && p.estado === 'aberta');
  const ativa = tarefaAtiva(t.estado);
  const drive = t.drive;
  const aviso = drive?.pasta ? avisoDoDrive(drive.situacao) : null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="fontes-titulo">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="fontes-titulo" className="text-xs font-bold uppercase tracking-wide text-brand">Fontes lidas</h3>
        <p className="flex items-center gap-1 text-xs text-muted"><Lock aria-hidden size={12} /> só leitura · o agente nunca altera nem apaga arquivos</p>
      </div>
      {podeMexer && ativa && drive && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {/* F1: o botão depende só de haver pasta e e-mail da conta; um erro antigo da conta não o esconde. */}
          {drive.pasta && drive.situacao?.email && <LerPasta tarefaId={t.id} />}
          {aviso && aviso.tom === 'warning' && <p className="flex items-center gap-1 text-warning"><TriangleAlert aria-hidden size={16} /> {aviso.texto}</p>}
          {!drive.pasta && (
            <p className="text-muted">
              Sem pasta no Drive: preencha na ficha do cliente, em Arquivos.
              {t.empresa && <> <Link href={`/clientes/${t.empresa.id}#bloco-arquivos`} className="text-brand underline-offset-4 hover:underline">Abrir a ficha</Link></>}
            </p>
          )}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <ul className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm" aria-label="Arquivos da tarefa">
          {t.arquivos.length === 0 && <li className="text-muted">Nenhum arquivo ainda.</li>}
          {t.arquivos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              {a.removido
                ? <span className="truncate text-muted">{a.nome}</span>
                : <a href={`/api/tarefas/arquivo?id=${a.id}`} className="truncate text-brand underline-offset-4 hover:underline">{a.nome}</a>}
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                {a.origem === 'drive'
                  ? <Badge variant="neutral"><LockKeyhole aria-hidden size={12} />{ROTULO_ORIGEM.drive}</Badge>
                  : <span>{ROTULO_ORIGEM[a.origem]}</span>}
                {a.removido && <span className="flex items-center gap-1"><Archive aria-hidden size={14} /> Apagado pela guarda</span>}
                {a.detalhe}
                {a.lido ? <CircleCheck aria-label="lido" size={16} className="text-success" /> : <span>não lido</span>}
              </span>
            </li>
          ))}
          {podeMexer && ativa && <li><EnviarArquivo tarefaId={t.id} /></li>}
        </ul>
        {faltando.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm">
            <p className="flex items-center gap-1 font-bold text-danger"><FileWarning aria-hidden size={16} /> Faltando</p>
            <ul className="flex flex-col gap-1">
              {faltando.map((p) => <li key={p.id}>{p.pergunta}{textoDoPedido(p, new Date()) ? <span className="text-muted"> · {textoDoPedido(p, new Date())}</span> : null}</li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
