import type { ReactNode } from 'react';
import type { Database } from '@escritorio/db';
import { DocumentText } from '@/components/patterns/document-text';
import { FormField } from '@/components/patterns/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarCliente, salvarResponsaveis, salvarServicos } from '../acoes';
import { classeCaixa, classeSelect } from '../estilos';
import { BotoesEdicao, EdicaoAlternavel } from './edicao-alternavel';

type Cliente = Database['public']['Tables']['clientes']['Row'];

const MOTIVO = 'Só quem pode editar clientes altera estes dados. Peça ao administrador na aba Usuários.';

function Dado({ rotulo, children, largo = false }: { rotulo: string; children: ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? 'sm:col-span-2' : undefined}>
      <dt className="text-sm text-muted">{rotulo}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

const vazio = <span className="text-subtle">—</span>;

/**
 * Só aparece quando o banco ainda não tem a migração da Parte H1 (D23); some numa parte futura.
 * Aba Dados: cadastro (leitura por padrão, "Editar" com permissão), serviços do contrato e responsável por setor.
 * Serviços e responsáveis continuam editáveis direto para quem tem a permissão (marcar e salvar); sem ela, só leitura.
 */
export async function SecaoDados({ id, u, pode, c, erro }: { id: string; u: UsuarioPainel; pode: boolean; c: Cliente; erro?: string }) {
  const sb = await supabaseServidor();
  const [rServicos, rContratados, rSetores, rUsuarios, rResp] = await Promise.all([
    sb.from('servicos').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('cliente_servicos').select('servico_id').eq('cliente_id', id),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('cliente_responsaveis').select('setor_id, usuario_id').eq('cliente_id', id),
  ]);
  const [servicos, contratados, setores, usuarios, resp] = [rServicos.data, rContratados.data, rSetores.data, rUsuarios.data, rResp.data];
  // Revisão geral (painel I7): leitura com erro não vira formulário vazio (salvar apagaria o contrato); aparece o aviso.
  const erroServicos = Boolean(rServicos.error || rContratados.error);
  const erroResponsaveis = Boolean(rSetores.error || rUsuarios.error || rResp.error);
  for (const e of [rServicos.error, rContratados.error, rSetores.error, rUsuarios.error, rResp.error]) if (e) console.error('[clientes] ficha antiga', e);
  const marcados = new Set((contratados ?? []).map((s) => s.servico_id));
  const responsavel = (setor: string) => resp?.find((r) => r.setor_id === setor)?.usuario_id ?? '';
  const admin = u.papel === 'admin';

  const leitura = (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Dado rotulo="Razão social">{c.razao_social}</Dado>
      <Dado rotulo="Nome fantasia">{c.nome_fantasia || vazio}</Dado>
      <Dado rotulo="CNPJ"><DocumentText valor={c.cnpj} tipo="cnpj" /></Dado>
      <Dado rotulo="Inscrição estadual">{c.inscricao_estadual || vazio}</Dado>
      <Dado rotulo="Regime">{c.regime || vazio}</Dado>
      <Dado rotulo="UF">{c.uf || vazio}</Dado>
      <Dado rotulo="Endereço" largo>{c.endereco || vazio}</Dado>
      <Dado rotulo="Agente para esta empresa" largo>
        {c.agente_pausado
          ? <Badge variant="agent-paused">Pausado: as mensagens dos contatos vão para a equipe</Badge>
          : <Badge variant="agent-active">Atende normalmente</Badge>}
      </Dado>
    </dl>
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <EdicaoAlternavel titulo="Dados cadastrais" pode={pode} erro={erro} motivo={MOTIVO} leitura={leitura}>
          <form action={salvarCliente.bind(null, id)}>
            <fieldset disabled={!pode} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
              <legend className="sr-only">Dados cadastrais</legend>
              <FormField id="dados-razao" rotulo="Razão social" obrigatorio>
                <Input name="razao_social" defaultValue={c.razao_social} />
              </FormField>
              <FormField id="dados-fantasia" rotulo="Nome fantasia"><Input name="nome_fantasia" defaultValue={c.nome_fantasia ?? ''} /></FormField>
              <FormField id="dados-cnpj" rotulo="CNPJ" obrigatorio><Input name="cnpj" defaultValue={c.cnpj} inputMode="numeric" /></FormField>
              <FormField id="dados-ie" rotulo="Inscrição estadual"><Input name="inscricao_estadual" defaultValue={c.inscricao_estadual ?? ''} /></FormField>
              <FormField id="dados-regime" rotulo="Regime"><Input name="regime" defaultValue={c.regime ?? ''} /></FormField>
              <FormField id="dados-uf" rotulo="UF"><Input name="uf" defaultValue={c.uf ?? ''} maxLength={2} className="w-20 uppercase" /></FormField>
              <FormField id="dados-endereco" rotulo="Endereço" className="sm:col-span-2"><Input name="endereco" defaultValue={c.endereco ?? ''} /></FormField>
              {admin && (
                <label className="flex items-center gap-2 text-base text-foreground sm:col-span-2">
                  <input type="checkbox" name="agente_pausado" defaultChecked={c.agente_pausado} className={classeCaixa} />
                  Pausar o agente para este cliente
                </label>
              )}
            </fieldset>
            {pode && <BotoesEdicao salvar="Salvar dados" />}
          </form>
        </EdicaoAlternavel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Serviços do contrato</CardTitle>
          <CardDescription>O que o escritório faz para esta empresa. O agente usa esta lista: assunto fora dela vira demanda marcada &quot;Fora do contrato&quot;.</CardDescription>
        </CardHeader>
        {erroServicos ? <AvisoLeitura /> : pode ? (
          <form action={salvarServicos.bind(null, id)}>
            <CardContent>
              <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <legend className="sr-only">Serviços do contrato</legend>
                {(servicos ?? []).map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-base text-foreground">
                    <input type="checkbox" name="servico" value={s.id} defaultChecked={marcados.has(s.id)} className={classeCaixa} />
                    {s.nome}
                  </label>
                ))}
                {(servicos ?? []).length === 0 && <p className="text-sm text-muted">Nenhum serviço ativo. Cadastre em Configurações.</p>}
              </fieldset>
            </CardContent>
            <div className="flex justify-end border-t border-border px-4 py-3"><Button type="submit" size="sm">Salvar serviços</Button></div>
          </form>
        ) : (
          <CardContent>
            {(servicos ?? []).some((s) => marcados.has(s.id)) ? (
              <ul className="flex flex-wrap gap-1.5">
                {(servicos ?? []).filter((s) => marcados.has(s.id)).map((s) => <li key={s.id}><Badge variant="outline">{s.nome}</Badge></li>)}
              </ul>
            ) : <p className="text-sm text-muted">Nenhum serviço marcado no contrato.</p>}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Responsável por setor</CardTitle>
          <CardDescription>Quem recebe as demandas desta empresa em cada setor. Sem responsável, a demanda cai na fila do setor.</CardDescription>
        </CardHeader>
        {erroResponsaveis ? <AvisoLeitura /> : pode ? (
          <form action={salvarResponsaveis.bind(null, id)}>
            <CardContent>
              <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <legend className="sr-only">Responsável por setor</legend>
                {(setores ?? []).map((s) => (
                  <FormField key={s.id} id={`resp-${s.id}`} rotulo={s.nome}>
                    <select name={`setor:${s.id}`} defaultValue={responsavel(s.id)} className={classeSelect}>
                      <option value="">Fila do setor</option>
                      {(usuarios ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </FormField>
                ))}
              </fieldset>
            </CardContent>
            <div className="flex justify-end border-t border-border px-4 py-3"><Button type="submit" size="sm">Salvar responsáveis</Button></div>
          </form>
        ) : (
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(setores ?? []).map((s) => (
                <Dado key={s.id} rotulo={s.nome}>
                  {usuarios?.find((p) => p.id === responsavel(s.id))?.nome ?? <span className="text-muted">Fila do setor</span>}
                </Dado>
              ))}
            </dl>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/** Revisão geral (painel I7): no lugar do formulário quando a leitura falhou. */
function AvisoLeitura() {
  return <CardContent><p role="alert" className="text-sm text-danger">Não consegui carregar esta parte agora. Recarregue a página antes de alterar.</p></CardContent>;
}
