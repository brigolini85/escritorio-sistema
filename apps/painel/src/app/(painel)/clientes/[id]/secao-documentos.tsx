import { Bot, Download, FileText, Trash2, Upload, Users } from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { EmptyState } from '@/components/patterns/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button, variantesBotao } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarIaDocumento, enviarDocumento, excluirDocumento } from '../cadastros-acoes';

/** Documentos da empresa (contrato social, certidões…) e quais o agente pode mandar sozinho a um contato autorizado. */
export async function SecaoDocumentos({ id, pode, admin }: { id: string; pode: boolean; admin: boolean }) {
  const sb = await supabaseServidor();
  const { data: docs } = await sb.from('documentos_empresa').select('id, nome, arquivo_nome, ia_pode_enviar').eq('cliente_id', id).order('nome');
  const lista = docs ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
          <CardDescription>
            Com a IA liberada, o documento é enviado na hora quando um contato autorizado desta empresa pedir. Os outros viram demanda para a equipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {lista.length === 0 ? (
            <EmptyState icone={FileText} className="py-6" titulo="Nenhum documento cadastrado." descricao={pode ? 'Envie o primeiro documento abaixo.' : undefined} />
          ) : (
            <ul className="divide-y divide-border">
              {lista.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
                    <span className="min-w-0 truncate text-base text-foreground">
                      <span className="font-medium">{d.nome}</span><span className="text-muted"> · {d.arquivo_nome}</span>
                    </span>
                    {d.ia_pode_enviar
                      ? <Badge variant="assistant"><Bot aria-hidden strokeWidth={1.75} />Liberado para a IA</Badge>
                      : <Badge variant="neutral"><Users aria-hidden strokeWidth={1.75} />só a equipe envia</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={`/api/documentos?id=${d.id}`} target="_blank" rel="noreferrer" className={variantesBotao({ variant: 'ghost', size: 'sm' })}>
                      <Download aria-hidden size={16} strokeWidth={1.75} />
                      Baixar
                    </a>
                    {pode && (
                      <form action={alternarIaDocumento.bind(null, id, d.id, !d.ia_pode_enviar)}>
                        <Button type="submit" variant="outline" size="sm">{d.ia_pode_enviar ? 'Bloquear para a IA' : 'Liberar para a IA'}</Button>
                      </form>
                    )}
                    {admin && (
                      <ConfirmDialog
                        gatilho={(
                          <Button type="button" variant="ghost" size="sm" className="text-danger hover:bg-danger-soft">
                            <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                            Excluir
                          </Button>
                        )}
                        titulo={`Excluir "${d.nome}"?`}
                        descricao="O arquivo é apagado do armazenamento e o agente deixa de poder enviá-lo. Não dá para desfazer."
                        confirmar="Excluir"
                        enviando="Excluindo…"
                        tipo="excluir"
                        acao={excluirDocumento.bind(null, id, d.id)}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {pode && (
        <Card>
          <CardHeader>
            <CardTitle>Enviar documento</CardTitle>
            <CardDescription>PDF ou imagem. Documento novo começa bloqueado para a IA; libere depois, se quiser.</CardDescription>
          </CardHeader>
          <form action={enviarDocumento.bind(null, id)}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input name="nome" required placeholder="Nome do documento (ex.: Contrato social)" aria-label="Nome do documento" className="sm:flex-1" />
              <Input name="arquivo" type="file" required accept="application/pdf,image/*" aria-label="Arquivo" className={cn('pt-1.5 text-sm sm:w-72')} />
              <Button type="submit" size="sm" className="shrink-0">
                <Upload aria-hidden size={16} strokeWidth={1.75} />
                Enviar documento
              </Button>
            </CardContent>
          </form>
        </Card>
      )}
    </div>
  );
}
