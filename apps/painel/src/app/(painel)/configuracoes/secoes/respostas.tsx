import { MessageSquareText, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { EmptyState } from '@/components/patterns/empty-state';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { classeCaixa } from '../../clientes/estilos';
import { removerResposta, salvarResposta } from '../acoes';
import { Cartao } from '../cartao';
import { AcoesLinhaConfig, FormularioConfig, SalvarConfig } from '../formulario-config';

type Resposta = { id: string; pergunta: string; resposta: string; ativo: boolean };

/** Respostas prontas, agora editáveis (spec 7C.4). Remover fica fora do formulário (um form não vai dentro de outro). */
export function SecaoRespostas({ respostas }: { respostas: Resposta[] }) {
  return (
    <Cartao id="respostas" titulo="Respostas prontas" descricao="O agente só responde sozinho o que estiver aqui e ativo (além de saudações e andamento de demandas).">
      <CardContent>
        {respostas.length === 0 ? (
          <EmptyState icone={MessageSquareText} titulo="Nenhuma resposta pronta." descricao="Adicione abaixo as perguntas que o agente pode responder sozinho." className="py-6" />
        ) : (
          <ul className="flex flex-col gap-3">
            {respostas.map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-md border border-border p-3">
                <FormularioConfig acao={salvarResposta.bind(null, r.id)} rotulo={`Resposta pronta: ${r.pergunta}`} className="flex min-w-0 flex-1 flex-col gap-2">
                  <Input name="pergunta" defaultValue={r.pergunta} aria-label={`Pergunta: ${r.pergunta}`} required minLength={3} maxLength={300} className="font-medium" />
                  <Textarea name="resposta" defaultValue={r.resposta} aria-label={`Resposta para: ${r.pergunta}`} required maxLength={2000} rows={2} className="min-h-16" />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-base text-foreground">
                      <input type="checkbox" name="ativo" defaultChecked={r.ativo} className={classeCaixa} /> ativa
                    </label>
                    <AcoesLinhaConfig rotulo={`Salvar a resposta pronta: ${r.pergunta}`} descartar={`Descartar alterações da resposta: ${r.pergunta}`} />
                  </div>
                </FormularioConfig>
                <ConfirmDialog
                  gatilho={(
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remover a resposta pronta: ${r.pergunta}`} className="size-8 shrink-0 text-muted hover:text-danger">
                      <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                    </Button>
                  )}
                  titulo="Remover resposta pronta?"
                  descricao={<>O agente deixa de responder sozinho a <strong className="font-medium text-foreground">{r.pergunta}</strong>.</>}
                  confirmar="Remover"
                  enviando="Removendo…"
                  acao={removerResposta.bind(null, r.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="border-t border-border">
        <FormularioConfig acao={salvarResposta.bind(null, null)} rotulo="Nova resposta pronta" limparAoSalvar className="flex w-full flex-col gap-2">
          <Input name="pergunta" placeholder="Pergunta (ex.: Qual o horário de atendimento?)" aria-label="Pergunta" required minLength={3} maxLength={300} />
          <Textarea name="resposta" placeholder="Resposta" aria-label="Resposta" required maxLength={2000} rows={2} className="min-h-16" />
          <SalvarConfig className="w-fit">Adicionar resposta</SalvarConfig>
        </FormularioConfig>
      </CardFooter>
    </Cartao>
  );
}
