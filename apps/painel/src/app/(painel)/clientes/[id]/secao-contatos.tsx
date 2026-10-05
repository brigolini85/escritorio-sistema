import { UserPlus, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { BotaoCadastrarContato, FormCadastroContato } from '@/components/patterns/form-cadastro-contato';
import { FormField } from '@/components/patterns/form-field';
import { Button, variantesBotao } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { lerContatosDaEmpresa } from '@/lib/acesso-contato';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarAgenteContato } from '../../atendimento/acoes';
import { adicionarContato, anonimizarContato, removerContato, vincularContatoExistente } from '../acoes';
import { classeCaixa, classeSelect } from '../estilos';
import { FaixaAguardando } from './faixa-aguardando';
import { LinhaAcesso } from './linha-acesso';
import { SecaoContatosAntiga } from './secao-contatos-antiga';

/**
 * Aba Contatos da ficha (spec 7D.2, imagem 00-cliente-contatos-acesso): quem fala pela empresa e o que cada pessoa pode
 * tratar. Linha aberta = bloco de acesso. Sem a migração da H2, a aba de antes com o aviso (D24).
 */
export async function SecaoContatos({ id, u, pode, aberto }: { id: string; u: UsuarioPainel; pode: boolean; aberto?: string | null }) {
  const sb = await supabaseServidor();
  const ficha = await lerContatosDaEmpresa(sb, id);
  if (ficha === 'sem-migracao') {
    return (
      <>
        <p role="note" className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted">
          O acesso por contato aparece quando a atualização do banco da Parte H for aplicada.
        </p>
        <SecaoContatosAntiga id={id} u={u} pode={pode} />
      </>
    );
  }
  if (ficha === null) return <p role="alert" className="text-sm text-danger">Não consegui carregar os contatos agora. Recarregue a página.</p>;
  const { data: todos } = pode ? await sb.from('contatos').select('id, nome, telefone').eq('ativo', true).order('nome') : { data: [] };
  const jaVinculados = new Set(ficha.contatos.map((c) => c.id));
  const disponiveis = (todos ?? []).filter((c) => !jaVinculados.has(c.id));
  const admin = u.papel === 'admin';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-foreground">
          Quem fala pela empresa e <strong className="font-semibold">o que cada pessoa pode tratar</strong> com o escritório e com o agente
        </p>
        {pode && (
          // É link: o botão "Adicionar contato" continua sendo o do cartão (a pergunta do contato arquivado vem junto).
          <a href="#adicionar-contato" className={variantesBotao({ size: 'sm' })}>
            <UserPlus aria-hidden size={16} strokeWidth={1.75} />
            Adicionar contato
          </a>
        )}
      </div>
      {ficha.aguardando > 0 && <FaixaAguardando n={ficha.aguardando} />}

      <Card>
        {ficha.contatos.length === 0 ? (
          <CardContent className="pt-4">
            <EmptyState
              icone={UserRound}
              className="py-6"
              titulo="Nenhum contato ligado a esta empresa."
              descricao={pode ? 'Adicione um contato novo ou vincule um que já está cadastrado.' : 'Quem pode editar clientes liga os contatos à empresa.'}
            />
          </CardContent>
        ) : (
          <Table aria-label="Contatos da empresa">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Celular</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Pode tratar</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead><span className="sr-only">Acesso</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ficha.contatos.map((c) => (
                <LinhaAcesso
                  key={c.id}
                  clienteId={id}
                  contato={c}
                  semServicoComSetor={ficha.semServicoComSetor}
                  socios={ficha.socios}
                  pode={pode}
                  aberta={aberto === c.id}
                  acoes={{
                    agente: alternarAgenteContato.bind(null, c.id, null, c.agentePausado),
                    ...(pode ? { remover: removerContato.bind(null, id, c.id) } : {}),
                    ...(admin ? { apagar: anonimizarContato.bind(null, id, c.id) } : {}),
                  }}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {pode && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card id="adicionar-contato" className="scroll-mt-20">
            <CardHeader>
              <CardTitle>Adicionar contato</CardTitle>
              <CardDescription>Cadastra o número e já liga à empresa.</CardDescription>
            </CardHeader>
            <FormCadastroContato action={adicionarContato.bind(null, id)} clienteId={id}>
              <CardContent className="flex flex-col gap-3">
                <FormField id="contato-nome" rotulo="Nome"><Input name="nome" required autoComplete="off" /></FormField>
                <FormField id="contato-telefone" rotulo="Telefone"><Input name="telefone" required inputMode="tel" placeholder="(31) 99999-0000" autoComplete="off" /></FormField>
                <label className="flex items-center gap-2 text-base text-foreground"><input type="checkbox" name="pode_pedir_nota" className={classeCaixa} />Pode pedir nota</label>
                <label className="flex items-center gap-2 text-base text-foreground"><input type="checkbox" name="pode_atualizar_preco" className={classeCaixa} />Pode mudar preço e cadastrar produto</label>
              </CardContent>
              <div className="flex justify-end border-t border-border px-4 py-3"><BotaoCadastrarContato size="sm">Adicionar contato</BotaoCadastrarContato></div>
            </FormCadastroContato>
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
