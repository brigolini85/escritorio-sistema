import { ChevronRight, Store, Truck } from 'lucide-react';
import { DocumentText } from '@/components/patterns/document-text';
import { EmptyState } from '@/components/patterns/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { enderecoPorExtenso } from '@/lib/resumo-pedido';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarGrupo, salvarUnidade } from '../cadastros-acoes';
import { classeCaixa, classeCampoLinha } from '../estilos';

/**
 * Clientes (redes/grupos) ou fornecedores da empresa, cada um com as unidades (CNPJ, endereço, CEP, telefone).
 * Os nomes são campos (Nome de <rede>) em modo leitura para quem não pode editar: desabilitados, sem botões.
 */
export async function SecaoParceiros({ id, tipo, pode }: { id: string; tipo: 'cliente' | 'fornecedor'; pode: boolean }) {
  const sb = await supabaseServidor();
  const { data: grupos } = await sb.from('parceiros_grupos')
    .select('id, nome, palavras_chave, ativo, parceiros_unidades(id, nome_unidade, razao_social, cnpj, inscricao_estadual, endereco, numero, complemento, cep, telefone, bairro, cidade, uf, palavras_chave, ativo)')
    .eq('cliente_id', id).eq('tipo', tipo).order('nome');
  const nomeGrupo = tipo === 'cliente' ? 'rede/cliente' : 'fornecedor';
  type Unidade = NonNullable<typeof grupos>[number]['parceiros_unidades'][number];

  const camposUnidade = (un?: Unidade) => (
    <fieldset disabled={!pode} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <legend className="sr-only">{un ? `Dados de ${un.nome_unidade}` : 'Dados da nova unidade'}</legend>
      <Input name="nome_unidade" defaultValue={un?.nome_unidade} placeholder="Nome da unidade (ex.: Santa Efigênia)" required className={classeCampoLinha} aria-label="Nome da unidade" />
      <Input name="razao_social" defaultValue={un?.razao_social ?? ''} placeholder="Razão social" className={classeCampoLinha} aria-label="Razão social da unidade" />
      <Input name="cnpj" defaultValue={un?.cnpj ?? ''} placeholder="CNPJ" inputMode="numeric" className={classeCampoLinha} aria-label="CNPJ da unidade" />
      <Input name="inscricao_estadual" defaultValue={un?.inscricao_estadual ?? ''} placeholder="Inscrição estadual" className={classeCampoLinha} aria-label="Inscrição estadual" />
      <Input name="endereco" defaultValue={un?.endereco ?? ''} placeholder="Endereço (rua, sem o número)" className={classeCampoLinha} aria-label="Endereço" />
      <Input name="numero" defaultValue={un?.numero ?? ''} placeholder="Número" className={classeCampoLinha} aria-label="Número" />
      <Input name="complemento" defaultValue={un?.complemento ?? ''} placeholder="Complemento" className={classeCampoLinha} aria-label="Complemento" />
      <Input name="bairro" defaultValue={un?.bairro ?? ''} placeholder="Bairro" className={classeCampoLinha} aria-label="Bairro" />
      <Input name="cidade" defaultValue={un?.cidade ?? ''} placeholder="Cidade" className={classeCampoLinha} aria-label="Cidade" />
      <Input name="uf" defaultValue={un?.uf ?? ''} placeholder="UF" maxLength={2} className={`${classeCampoLinha} uppercase`} aria-label="UF" />
      <Input name="cep" defaultValue={un?.cep ?? ''} placeholder="CEP" inputMode="numeric" className={classeCampoLinha} aria-label="CEP" />
      <Input name="telefone" defaultValue={un?.telefone ?? ''} placeholder="Telefone/celular" inputMode="tel" className={classeCampoLinha} aria-label="Telefone da unidade" />
      <Input name="palavras_chave" defaultValue={un?.palavras_chave.join(', ')} placeholder="Palavras-chave, separadas por vírgula" className={`${classeCampoLinha} sm:col-span-2 lg:col-span-3`} aria-label="Palavras-chave da unidade" />
    </fieldset>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {tipo === 'cliente'
          ? 'Para quem a empresa vende. O agente usa estes cadastros para montar o pedido de nota (destinatário, CNPJ e endereço de entrega).'
          : 'De quem a empresa compra.'}
      </p>
      {(grupos ?? []).length === 0 && (
        <Card>
          <EmptyState
            icone={tipo === 'cliente' ? Store : Truck}
            titulo={`Nenhum ${nomeGrupo} cadastrado.`}
            descricao={pode ? `Use o formulário abaixo para criar o primeiro ${nomeGrupo}.` : 'Quem pode editar clientes faz estes cadastros.'}
          />
        </Card>
      )}
      {(grupos ?? []).map((g) => (
        <Card key={g.id} className={g.ativo ? undefined : 'opacity-70'}>
          <form action={salvarGrupo.bind(null, id, tipo, g.id)} className="flex flex-wrap items-center gap-2 border-b border-border p-4">
            <fieldset disabled={!pode} className="contents">
              <Input name="nome" defaultValue={g.nome} required className="h-9 w-full font-semibold sm:w-64" aria-label={`Nome de ${g.nome}`} />
              <Input name="palavras_chave" defaultValue={g.palavras_chave.join(', ')} placeholder="Palavras-chave da rede" className="h-9 min-w-48 flex-1" aria-label={`Palavras-chave de ${g.nome}`} />
              <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" name="ativo" defaultChecked={g.ativo} className={classeCaixa} /> Ativo</label>
              {!g.ativo && <Badge variant="neutral">Inativo</Badge>}
              {pode && <Button type="submit" variant="outline" size="sm">Salvar</Button>}
            </fieldset>
          </form>
          <div className="flex flex-col gap-2 p-4">
            {g.parceiros_unidades.length === 0 && <p className="text-sm text-muted">Nenhuma unidade cadastrada.</p>}
            <ul className="flex flex-col gap-2">
              {g.parceiros_unidades.map((un) => {
                const endereco = enderecoPorExtenso(un);
                return (
                  <li key={un.id}>
                    <details className="group rounded-md border border-border">
                      <summary className="flex cursor-pointer list-none items-start gap-2 rounded-md p-3 hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                        <ChevronRight aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted transition-transform duration-150 ease-out group-open:rotate-90" />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-base text-foreground">
                            {un.nome_unidade}{un.bairro ? ` · ${un.bairro}` : ''}{un.cidade ? ` · ${un.cidade}` : ''}{un.cnpj ? ` · CNPJ ${un.cnpj}` : ''}{un.ativo ? '' : ' · inativa'}
                          </span>
                          <span className="flex flex-wrap gap-x-3 text-sm text-muted">
                            {/* Endereço por extenso, com o CEP (o mesmo texto do pedido de nota). */}
                            <span>{endereco ?? 'Sem endereço cadastrado'}</span>
                            {un.telefone && <span>Tel. <DocumentText valor={un.telefone} tipo="telefone" /></span>}
                          </span>
                        </span>
                      </summary>
                      <form action={salvarUnidade.bind(null, id, g.id, un.id)} className="flex flex-col gap-3 border-t border-border p-3">
                        {camposUnidade(un)}
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" name="ativo" defaultChecked={un.ativo} disabled={!pode} className={classeCaixa} /> Ativa</label>
                          {pode && <Button type="submit" size="sm">Salvar unidade</Button>}
                        </div>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
            {pode && (
              <form action={salvarUnidade.bind(null, id, g.id, null)} className="mt-2 flex flex-col gap-3 rounded-md border border-dashed border-border p-3">
                <p className="text-sm font-medium text-foreground">Nova unidade de {g.nome}</p>
                {camposUnidade()}
                <div className="flex justify-end"><Button type="submit" variant="outline" size="sm">Adicionar unidade</Button></div>
              </form>
            )}
          </div>
        </Card>
      ))}
      {pode && (
        <Card>
          <form action={salvarGrupo.bind(null, id, tipo, null)} className="flex flex-wrap items-center gap-2 p-4">
            <Input name="nome" required placeholder={tipo === 'cliente' ? 'Nova rede/cliente (ex.: Supermercado Brasil)' : 'Novo fornecedor'} className="h-9 min-w-56 flex-1" aria-label={tipo === 'cliente' ? 'Nome da nova rede/cliente' : 'Nome do novo fornecedor'} />
            <Input name="palavras_chave" placeholder="Palavras-chave, separadas por vírgula" className="h-9 min-w-56 flex-1" aria-label="Palavras-chave" />
            <Button type="submit" size="sm">{tipo === 'cliente' ? 'Criar rede' : 'Criar fornecedor'}</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
