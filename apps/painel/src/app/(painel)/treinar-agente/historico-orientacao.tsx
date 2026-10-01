import { History, RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { EmptyState } from '@/components/patterns/empty-state';
import { RelativeTime } from '@/components/patterns/relative-time';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatarDataHora } from '@/lib/formatos';
import { mesmoConteudo, resumoVersao, type Versao } from './versoes';

type Acao = (dados: FormData) => void | Promise<void>;

/**
 * Histórico da orientação (da versão mais nova para a mais antiga): ação, quem, quando, o retrato de cada versão
 * e "Restaurar esta versão" nas que têm conteúdo diferente do atual. Restaurar não liga nem desliga (restaurar_orientacao).
 */
export function HistoricoOrientacao({ versoes, atual, valePara, restaurar }: {
  versoes: Versao[];
  atual: Pick<Versao, 'titulo' | 'texto' | 'tipo' | 'clienteId' | 'setorId' | 'ativo'>;
  /** "Todos os clientes", "Empresa X", "Setor Y" de um retrato. */
  valePara: (v: Pick<Versao, 'clienteId' | 'setorId'>) => string;
  restaurar: (versaoId: string) => Acao;
}) {
  if (versoes.length === 0) {
    return <EmptyState icone={History} titulo="Sem histórico ainda." descricao="Cada criação, edição, ligar, desligar e restauração aparece aqui." />;
  }
  return (
    <ol aria-label="Versões da orientação" className="flex flex-col">
      {versoes.map((v, i) => {
        const podeRestaurar = !mesmoConteudo(v, atual);
        return (
          <li key={v.id} className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-foreground">{resumoVersao(versoes, i)}</p>
              <span className="flex items-center gap-2 text-sm text-muted">
                {i === 0 && <Badge variant="brand">Versão atual</Badge>}
                <RelativeTime data={v.criadoEm} focavel />
              </span>
            </div>
            <p className="text-sm text-muted">por {v.usuario ?? 'pessoa removida'}</p>
            <details className="group rounded-md border border-border bg-surface-muted px-3 py-2 text-sm">
              <summary className="cursor-pointer text-foreground">Ver esta versão</summary>
              <div className="mt-2 flex flex-col gap-1.5">
                <p className="flex flex-wrap items-center gap-2 text-muted">
                  <StatusBadge tipo="orientacao" status={v.tipo} />
                  <span>{valePara(v)} · {v.ativo ? 'ligada' : 'desligada'}</span>
                </p>
                <p className="font-medium text-foreground">{v.titulo}</p>
                <p className="whitespace-pre-wrap break-words text-foreground">{v.texto}</p>
              </div>
            </details>
            {podeRestaurar && (
              <div>
                <ConfirmDialog
                  gatilho={<Button variant="outline" size="sm"><RotateCcw aria-hidden size={16} strokeWidth={1.75} />Restaurar esta versão</Button>}
                  titulo="Restaurar esta versão?"
                  descricao={(
                    <>
                      O título, o tipo, o texto e para quem vale voltam a ser os da versão de {formatarDataHora(v.criadoEm)}.
                      A orientação continua {atual.ativo ? 'ligada' : 'desligada'}: restaurar não liga nem desliga nada.
                      A versão de agora continua no histórico.
                    </>
                  )}
                  confirmar="Restaurar"
                  enviando="Restaurando…"
                  variante="primary"
                  acao={restaurar(v.id)}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
