import { Bot, Download, FileText, Trash2, Upload, Users } from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { EmptyState } from '@/components/patterns/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button, variantesBotao } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarIaDocumento, definirSetorDocumento, enviarDocumento, excluirDocumento } from '../cadastros-acoes';
import { lerDocumentosDaEmpresa, lerSetoresDeDocumento, setoresEscolhiveis, type SetorDeDocumento } from '../documento-setor';
import { CampoSetorDocumento } from './campo-setor-documento';

/** Documentos da empresa (contrato social, certidões…) e quais o agente pode mandar sozinho a um contato autorizado. */
export async function SecaoDocumentos({ id, pode, admin }: { id: string; pode: boolean; admin: boolean }) {
  const sb = await supabaseServidor();
  const docs = await lerDocumentosDaEmpresa(sb, id);
  // Erro ao ler os documentos (não é banco sem a migração): avisa e não mostra o envio, como na falha dos setores.
  if (!docs) {
    return <p role="alert" className="text-sm text-danger">Não consegui carregar os documentos agora. Recarregue a página.</p>;
  }
  const { lista, comSetor } = docs;
  // Todos os setores (inclusive desativados, para o nome do atual); erro na leitura nunca vira lista vazia (o Salvar
  // trocaria o setor de todos por "da empresa"): a tela avisa e não mostra o setor nem o envio.
  let todos: SetorDeDocumento[] = [];
  let falhaSetores = false;
  if (comSetor) {
    try {
      todos = await lerSetoresDeDocumento(sb);
    } catch (e) {
      console.error('[documentos] falha ao ler os setores', e);
      falhaSetores = true;
    }
  }
  const usaSetor = comSetor && !falhaSetores;
  // Direção nunca é escolhida (D5): é para onde vão os assuntos sensíveis.
  const escolhiveis = setoresEscolhiveis(todos);
  const porId = new Map(todos.map((s) => [s.id, s]));
  // O setor atual do documento sempre está entre as opções, mesmo desativado: Salvar sem escolher outro o mantém.
  const opcoes = (setorId: string | null | undefined) => {
    const atual = setorId ? porId.get(setorId) : undefined;
    if (!setorId || escolhiveis.some((s) => s.id === setorId)) return escolhiveis;
    return [{ id: setorId, nome: atual ? `${atual.nome}${atual.ativo ? '' : ' (desativado)'}` : 'Setor removido' }, ...escolhiveis];
  };
  const rotuloSetor = (setorId: string | null | undefined) => {
    if (!setorId) return 'da empresa';
    const s = porId.get(setorId);
    return s ? `${s.nome}${s.ativo ? '' : ' (desativado)'}` : 'setor removido';
  };
  return (
    <div className="flex flex-col gap-4">
      {falhaSetores && (
        <p role="alert" className="text-sm text-danger">Não consegui ler os setores agora: o setor dos documentos e o envio voltam ao recarregar a página.</p>
      )}
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
                    {usaSetor && <Badge variant="neutral">{rotuloSetor(d.setor_id)}</Badge>}
                    {usaSetor && d.tem_valores && <Badge variant="warning">com valores</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {pode && usaSetor && (
                      <form action={definirSetorDocumento.bind(null, id, d.id)} className="flex flex-wrap items-center gap-2">
                        <CampoSetorDocumento
                          setores={opcoes(d.setor_id)}
                          setorId={d.setor_id}
                          temValores={d.tem_valores}
                          rotulo={`Setor de ${d.nome}`}
                          rotuloValores={`Tem valores em ${d.nome}`}
                        />
                        <Button type="submit" size="sm" variant="ghost" aria-label={`Salvar o setor de ${d.nome}`}>Salvar</Button>
                      </form>
                    )}
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
                        titulo={<>Excluir <strong className="font-extrabold">{d.nome}</strong>?</>}
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

      {pode && !falhaSetores && (
        <Card>
          <CardHeader>
            <CardTitle>Enviar documento</CardTitle>
            <CardDescription>
              PDF ou imagem. Documento novo começa bloqueado para a IA; libere depois, se quiser.
              {usaSetor && ' O agente só manda o documento a quem pode tratar o setor dele; documento com valores, só a quem pode ver valores.'}
            </CardDescription>
          </CardHeader>
          <form action={enviarDocumento.bind(null, id)}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Input name="nome" required placeholder="Nome do documento (ex.: Contrato social)" aria-label="Nome do documento" className="sm:min-w-72 sm:flex-1" />
              <Input name="arquivo" type="file" required accept="application/pdf,image/*" aria-label="Arquivo" className={cn('pt-1.5 text-sm sm:w-72')} />
              {usaSetor && <CampoSetorDocumento setores={escolhiveis} rotulo="Setor do documento" />}
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
