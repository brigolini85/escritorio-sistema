import { Package } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarProduto } from '../cadastros-acoes';
import { classeCaixa, classeCampoLinha } from '../estilos';

// Linha em colunas de largura fixa (código, unidade, situação) e flexível (descrição, apelidos); empilha no celular.
const linha = 'flex flex-col gap-2 sm:flex-row sm:items-center';
const col = { codigo: 'sm:w-20 sm:shrink-0', descricao: 'sm:min-w-0 sm:flex-1', unidade: 'sm:w-32 sm:shrink-0', apelidos: 'sm:min-w-0 sm:flex-1', situacao: 'sm:w-20 sm:shrink-0', acao: 'sm:w-16 sm:shrink-0' };

/**
 * Produtos que a empresa vende (código, descrição, unidade e apelidos que o agente reconhece).
 * Com permissão: cada linha é um formulário (edita e salva ali mesmo). Sem permissão: tabela só de leitura.
 */
export async function SecaoProdutos({ id, pode }: { id: string; pode: boolean }) {
  const sb = await supabaseServidor();
  const { data: produtos } = await sb.from('produtos').select('*').eq('cliente_id', id).order('descricao');
  const lista = produtos ?? [];

  if (!pode) {
    return (
      <Card className="overflow-hidden">
        {lista.length === 0 ? (
          <EmptyState icone={Package} titulo="Nenhum produto cadastrado." descricao="Quem pode editar clientes cadastra os produtos." />
        ) : (
          <Table aria-label="Produtos">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead>Unidade</TableHead><TableHead>Apelidos</TableHead><TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="tabular text-muted">{p.codigo}</TableCell>
                  <TableCell className="font-medium">{p.descricao}</TableCell>
                  <TableCell>{p.unidade}</TableCell>
                  <TableCell className="text-muted">{p.apelidos.join(', ') || '—'}</TableCell>
                  <TableCell>{p.ativo ? <Badge variant="success">Ativo</Badge> : <Badge variant="neutral">Inativo</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-2 p-4">
        <div aria-hidden className={`${linha} hidden border-b border-border pb-2 text-sm font-medium text-muted sm:flex`}>
          <span className={col.codigo}>Código</span><span className={col.descricao}>Descrição</span><span className={col.unidade}>Unidade</span>
          <span className={col.apelidos}>Apelidos (o agente reconhece)</span><span className={col.situacao}>Situação</span><span className={col.acao} />
        </div>
        {lista.length === 0 && <p className="py-2 text-sm text-muted">Nenhum produto cadastrado. Adicione o primeiro abaixo.</p>}
        {lista.map((p) => (
          <form key={p.id} action={salvarProduto.bind(null, id, p.id)} className={`${linha} ${p.ativo ? '' : 'opacity-70'}`}>
            <Input name="codigo" defaultValue={p.codigo} className={`${classeCampoLinha} ${col.codigo} tabular`} aria-label={`Código de ${p.codigo}`} />
            <Input name="descricao" defaultValue={p.descricao} className={`${classeCampoLinha} ${col.descricao}`} aria-label={`Descrição de ${p.codigo}`} />
            <Input name="unidade" defaultValue={p.unidade} className={`${classeCampoLinha} ${col.unidade}`} aria-label={`Unidade de ${p.codigo}`} />
            <Input name="apelidos" defaultValue={p.apelidos.join(', ')} className={`${classeCampoLinha} ${col.apelidos}`} aria-label={`Apelidos de ${p.codigo}`} />
            <label className={`flex items-center gap-2 text-sm text-foreground ${col.situacao}`}><input type="checkbox" name="ativo" defaultChecked={p.ativo} className={classeCaixa} /> Ativo</label>
            <span className={col.acao}><Button type="submit" variant="outline" size="sm">Salvar</Button></span>
          </form>
        ))}
        <form action={salvarProduto.bind(null, id, null)} className={`${linha} mt-2 border-t border-border pt-3`}>
          <Input name="codigo" placeholder="Código" required className={`${classeCampoLinha} ${col.codigo}`} aria-label="Código do novo produto" />
          <Input name="descricao" placeholder="Descrição" required className={`${classeCampoLinha} ${col.descricao}`} aria-label="Descrição do novo produto" />
          <Input name="unidade" placeholder="Unidade (PAC, KG…)" className={`${classeCampoLinha} ${col.unidade}`} aria-label="Unidade do novo produto" />
          <Input name="apelidos" placeholder="Apelidos, separados por vírgula" className={`${classeCampoLinha} ${col.apelidos}`} aria-label="Apelidos do novo produto" />
          <span className="sm:w-38 sm:shrink-0"><Button type="submit" size="sm" className="w-full">Adicionar produto</Button></span>
        </form>
      </div>
    </Card>
  );
}
