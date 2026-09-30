import { ShieldAlert, UserRound, UserRoundMinus } from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { EmptyState } from '@/components/patterns/empty-state';
import { FormField } from '@/components/patterns/form-field';
import { SwitchAgenteContato } from '@/components/patterns/switch-agente-contato';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarAgenteContato } from '../../atendimento/acoes';
import { adicionarContato, anonimizarContato, removerContato, vincularContatoExistente } from '../acoes';
import { classeCaixa, classeSelect } from '../estilos';

/**
 * Aba Contatos da ficha: quem fala pela empresa no WhatsApp, o que cada um pode pedir e se o agente atende.
 * A linha de cada contato mantém o texto "Nome · telefone · pode pedir nota…" (é o que a equipe e os testes leem).
 */
export async function SecaoContatos({ id, u, pode }: { id: string; u: UsuarioPainel; pode: boolean }) {
  const sb = await supabaseServidor();
  const { data: vinculos } = await sb.from('contato_clientes')
    .select('pode_pedir_nota, pode_atualizar_preco, contatos(id, nome, telefone, agente_pausado)').eq('cliente_id', id);
  const { data: todos } = await sb.from('contatos').select('id, nome, telefone').eq('ativo', true).order('nome');
  const lista = (vinculos ?? []).flatMap((v) => (v.contatos ? [{ ...v, contato: v.contatos }] : []))
    .sort((a, b) => a.contato.nome.localeCompare(b.contato.nome, 'pt-BR'));
  const jaVinculados = new Set(lista.map((v) => v.contato.id));
  const disponiveis = (todos ?? []).filter((c) => !jaVinculados.has(c.id));
  const admin = u.papel === 'admin';

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Contatos autorizados no WhatsApp</CardTitle>
          <CardDescription>Quem pode falar com o agente em nome desta empresa. A chave liga ou desliga o agente só para aquele contato.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {lista.length === 0 ? (
            <EmptyState
              icone={UserRound}
              className="py-6"
              titulo="Nenhum contato ligado a esta empresa."
              descricao={pode ? 'Adicione um contato novo ou vincule um que já está cadastrado.' : 'Quem pode editar clientes liga os contatos à empresa.'}
            />
          ) : (
            <ul className="divide-y divide-border">
              {lista.map((v) => (
                <li key={v.contato.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                  <p className="min-w-0 text-base text-foreground">
                    <span className="font-medium">{v.contato.nome}</span>
                    <span className="tabular text-muted"> · {v.contato.telefone}</span>
                    <span className="text-muted">
                      {v.pode_pedir_nota ? ' · pode pedir nota' : ''}
                      {v.pode_atualizar_preco ? ' · pode mudar preço e cadastrar produto' : ''}
                    </span>
                    {v.contato.agente_pausado && <span className="text-agent-paused"> · agente desligado</span>}
                  </p>
                  <div className="flex items-center gap-1">
                    <SwitchAgenteContato
                      acao={alternarAgenteContato.bind(null, v.contato.id, null, v.contato.agente_pausado)}
                      desligado={v.contato.agente_pausado}
                      nome={v.contato.nome}
                      pode={pode}
                      className="mr-2"
                    />
                    {pode && (
                      <form action={removerContato.bind(null, id, v.contato.id)}>
                        <Button type="submit" variant="ghost" size="sm" title={`Tira ${v.contato.nome} desta empresa (o contato continua cadastrado)`}>
                          <UserRoundMinus aria-hidden size={16} strokeWidth={1.75} />
                          Remover
                        </Button>
                      </form>
                    )}
                    {admin && (
                      <ConfirmDialog
                        gatilho={(
                          <Button type="button" variant="ghost" size="sm" className="text-danger hover:bg-danger-soft">
                            <ShieldAlert aria-hidden size={16} strokeWidth={1.75} />
                            Apagar dados (LGPD)
                          </Button>
                        )}
                        titulo={`Apagar os dados de ${v.contato.nome}?`}
                        descricao="Nome, telefone, mensagens, áudios e arquivos deste contato são apagados de vez, em todas as empresas. Não dá para desfazer."
                        confirmar="Apagar dados"
                        enviando="Apagando…"
                        digitarParaConfirmar={v.contato.nome}
                        acao={anonimizarContato.bind(null, id, v.contato.id)}
                      >
                        <input type="hidden" name="confirmo" value="on" />
                      </ConfirmDialog>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {pode && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar contato</CardTitle>
              <CardDescription>Cadastra o número e já liga à empresa.</CardDescription>
            </CardHeader>
            <form action={adicionarContato.bind(null, id)}>
              <CardContent className="flex flex-col gap-3">
                <FormField id="contato-nome" rotulo="Nome"><Input name="nome" required autoComplete="off" /></FormField>
                <FormField id="contato-telefone" rotulo="Telefone"><Input name="telefone" required inputMode="tel" placeholder="(31) 99999-0000" autoComplete="off" /></FormField>
                <label className="flex items-center gap-2 text-base text-foreground"><input type="checkbox" name="pode_pedir_nota" className={classeCaixa} />Pode pedir nota</label>
                <label className="flex items-center gap-2 text-base text-foreground"><input type="checkbox" name="pode_atualizar_preco" className={classeCaixa} />Pode mudar preço e cadastrar produto</label>
              </CardContent>
              <div className="flex justify-end border-t border-border px-4 py-3"><Button type="submit" size="sm">Adicionar contato</Button></div>
            </form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vincular contato já cadastrado</CardTitle>
              <CardDescription>Para quem já fala com o escritório (cadastrado em Contatos ou pela conversa).</CardDescription>
            </CardHeader>
            {disponiveis.length > 0 ? (
              <form action={vincularContatoExistente.bind(null, id)}>
                <CardContent className="flex flex-col gap-3">
                  <FormField id="vincular-contato" rotulo="Contato já cadastrado">
                    <select name="contato_id" required defaultValue="" className={classeSelect}>
                      <option value="" disabled>Escolha…</option>
                      {disponiveis.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.telefone}</option>)}
                    </select>
                  </FormField>
                  <label className="flex items-center gap-2 text-base text-foreground"><input type="checkbox" name="pode_pedir_nota" className={classeCaixa} />Pode pedir nota (vínculo)</label>
                  <label className="flex items-center gap-2 text-base text-foreground"><input type="checkbox" name="pode_atualizar_preco" className={classeCaixa} />Pode mudar preço e cadastrar produto (vínculo)</label>
                </CardContent>
                <div className="flex justify-end border-t border-border px-4 py-3"><Button type="submit" size="sm" variant="outline">Vincular contato</Button></div>
              </form>
            ) : (
              <CardContent><p className="text-sm text-muted">Todos os contatos cadastrados já estão ligados a esta empresa.</p></CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
