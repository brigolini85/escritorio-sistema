import { CalendarOff, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { EmptyState } from '@/components/patterns/empty-state';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { diaCurto } from '@/lib/configuracoes';
import { formatarData } from '@/lib/formatos';
import { adicionarFeriado, removerFeriado } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, SalvarConfig } from '../formulario-config';

/** Feriados (Configurações: Sim): o prazo das demandas pula estes dias. `feriados` vem ordenado por data. */
export function SecaoFeriados({ feriados, hoje }: { feriados: { data: string; descricao: string }[]; hoje: string }) {
  const proximo = feriados.find((f) => f.data >= hoje);
  return (
    <Cartao
      id="feriados"
      titulo="Feriados"
      descricao={(
        <>
          Dias sem expediente: o prazo das demandas pula estes dias.{' '}
          {proximo
            ? <>Próximo: <strong className="font-semibold text-foreground">{diaCurto(`${proximo.data}T12:00:00-03:00`)}, {proximo.descricao}</strong>.</>
            : 'Nenhum feriado à frente.'}
        </>
      )}
    >
      <CardContent>
        {feriados.length === 0 ? (
          <EmptyState icone={CalendarOff} titulo="Nenhum feriado cadastrado." className="py-6" />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {feriados.map((f) => {
              const data = formatarData(`${f.data}T12:00:00-03:00`);
              const passou = f.data < hoje;
              return (
                <li key={f.data} className="flex items-center gap-3 px-3 py-2">
                  <span className={cn('tabular w-24 shrink-0', passou ? 'text-subtle' : 'text-muted')}>{data}</span>
                  <span className={cn('min-w-0 flex-1 truncate', passou ? 'text-subtle' : 'text-foreground')}>{f.descricao}{passou && <span className="sr-only"> (já passou)</span>}</span>
                  <ConfirmDialog
                    gatilho={(
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remover o feriado ${data}`} className="size-8 text-muted hover:text-danger">
                        <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                      </Button>
                    )}
                    titulo="Remover feriado?"
                    descricao={`${data} · ${f.descricao} volta a ser dia normal de expediente.`}
                    confirmar="Remover"
                    enviando="Removendo…"
                    acao={removerFeriado.bind(null, f.data)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <CardFooter className="border-t border-border">
        <FormularioConfig acao={adicionarFeriado} rotulo="Novo feriado" limparAoSalvar className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <Input type="date" name="data" aria-label="Data do feriado" required className="tabular sm:w-44" />
          <Input name="descricao" placeholder="Descrição" aria-label="Descrição do feriado" required maxLength={80} className="sm:flex-1" />
          <SalvarConfig>Adicionar</SalvarConfig>
        </FormularioConfig>
      </CardFooter>
    </Cartao>
  );
}
