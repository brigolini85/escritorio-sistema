import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatarDataHora } from '@/lib/formatos';
import { ROTULO_TIPO } from '@/lib/orientacoes';
import type { LinhaHistorico } from './tela';
import type { Versao } from './versoes';

type Acao = (dados: FormData) => void | Promise<void>;

/**
 * Histórico em tabela compacta embaixo do editor (spec 7C.5, D15): quando, o que aconteceu e quem, "atual" na mais nova,
 * "Ver esta versão" e RESTAURAR onde o conteúdo difere do atual. Restaurar não liga nem desliga (restaurar_orientacao).
 * Em "Ver esta versão", o "vale para" vem como "Vale para: <nome>" (sem repetir "Empresa <nome>" do alto do editor).
 */
export function HistoricoTabela({ linhas, versoes, ligada, valePara, restaurar, aviso }: {
  linhas: LinhaHistorico[];
  versoes: Versao[];
  ligada: boolean;
  /** "Padaria Sol", "setor Fiscal" ou "todos os clientes" de um retrato. */
  valePara: (v: Pick<Versao, 'clienteId' | 'setorId'>) => string;
  restaurar: (versaoId: string) => Acao;
  aviso?: ReactNode;
}) {
  const n = linhas.length;
  return (
    <section id="historico" aria-labelledby="titulo-historico" className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h3 id="titulo-historico" className="text-sm font-bold uppercase tracking-wide text-brand">Histórico · {n === 1 ? '1 versão' : `${n} versões`}</h3>
        <p className="text-sm text-muted">restaurar não liga nem desliga</p>
      </div>
      {aviso && <div className="px-4 pt-3">{aviso}</div>}
      {n === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">Sem histórico ainda. Cada criação, edição, ligar, desligar e restauração aparece aqui.</p>
      ) : (
        <table aria-label="Versões da orientação" className="w-full text-sm">
          <thead className="sr-only">
            <tr><th scope="col">Quando</th><th scope="col">O que aconteceu</th><th scope="col">Restaurar</th></tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const v = versoes[i]!;
              return (
                <tr key={l.id} className="border-b border-border align-top last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular text-muted">{l.quando}</td>
                  <td className="px-2 py-2.5">
                    <span className="font-semibold text-foreground">{l.resumo}</span>{' '}
                    <span className="text-muted">{l.por}</span>
                    {l.atual && <Badge variant="brand" className="ml-2">atual</Badge>}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted">Ver esta versão</summary>
                      <div className="mt-1 flex flex-col gap-1 rounded-md bg-surface-muted p-2">
                        <p className="text-muted">{ROTULO_TIPO[v.tipo]} · Vale para: {valePara(v)} · {v.ativo ? 'ligada' : 'desligada'}</p>
                        <p className="font-medium text-foreground">{v.titulo}</p>
                        <p className="whitespace-pre-wrap break-words text-foreground">{v.texto}</p>
                      </div>
                    </details>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {l.podeRestaurar && (
                      <ConfirmDialog
                        gatilho={(
                          <Button variant="link" size="sm" aria-label="Restaurar esta versão" className="font-bold uppercase">
                            <RotateCcw aria-hidden size={14} strokeWidth={1.75} />
                            Restaurar
                          </Button>
                        )}
                        titulo="Restaurar esta versão?"
                        descricao={(
                          <>
                            O título, o tipo, o texto e para quem vale voltam a ser os da versão de {formatarDataHora(v.criadoEm)}.
                            A orientação continua {ligada ? 'ligada' : 'desligada'}: restaurar não liga nem desliga nada.
                            A versão de agora continua no histórico.
                          </>
                        )}
                        confirmar="Restaurar"
                        enviando="Restaurando…"
                        variante="primary"
                        acao={restaurar(v.id)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
