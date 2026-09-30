import { Bot, Check, History, Tags, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/patterns/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { variantesBotao } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { definirPreco } from '../cadastros-acoes';

// Texto do histórico com espaço comum (a equipe e os testes procuram "R$ 10,00 · vigente").
const reais = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const valorCampo = (v: number) => v.toFixed(2).replace('.', ',');
const data = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

/**
 * Preços por rede: produto × rede, com o valor vigente (e se foi o agente que mudou) e o histórico (?historico=rede:produto).
 * Sem "Editar preços": os campos aparecem desabilitados.
 */
export async function SecaoPrecos({ id, podeEditar, historico }: { id: string; podeEditar: boolean; historico?: string }) {
  const sb = await supabaseServidor();
  const [{ data: redes }, { data: produtos }, { data: vigentes }] = await Promise.all([
    sb.from('parceiros_grupos').select('id, nome').eq('cliente_id', id).eq('tipo', 'cliente').eq('ativo', true).order('nome'),
    sb.from('produtos').select('id, codigo, descricao, unidade').eq('cliente_id', id).eq('ativo', true).order('descricao'),
    sb.from('precos').select('grupo_id, produto_id, valor, origem').eq('cliente_id', id).is('vigente_ate', null),
  ]);
  const vigente = (g: string, p: string) => vigentes?.find((x) => x.grupo_id === g && x.produto_id === p);
  const [hGrupo, hProduto] = (historico ?? '').split(':');
  const { data: linhasHistorico } = hGrupo && hProduto
    ? await sb.from('precos').select('valor, vigente_desde, vigente_ate, origem, usuarios(nome), contatos(nome)').eq('grupo_id', hGrupo).eq('produto_id', hProduto).order('vigente_desde', { ascending: false })
    : { data: null };

  if (!(redes ?? []).length || !(produtos ?? []).length) {
    return (
      <Card>
        <EmptyState
          icone={Tags}
          titulo="Ainda não dá para montar a tabela de preços."
          descricao={'Cadastre ao menos uma rede em "Clientes e fornecedores" e um produto em "Produtos" para montar a tabela de preços.'}
          acao={(
            <>
              <Link href={`/clientes/${id}?aba=clientes`} className={variantesBotao({ variant: 'outline', size: 'sm' })}>Cadastrar rede</Link>
              <Link href={`/clientes/${id}?aba=produtos`} className={variantesBotao({ variant: 'outline', size: 'sm' })}>Cadastrar produto</Link>
            </>
          )}
        />
      </Card>
    );
  }
  const redeHist = redes!.find((r) => r.id === hGrupo);
  const produtoHist = produtos!.find((p) => p.id === hProduto);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Preço de cada produto para cada rede. O agente usa o preço vigente no pedido de nota.
        {!podeEditar && ' Para mudar preços é preciso a permissão "Editar preços" (peça ao administrador na aba Usuários).'}
      </p>
      <Card className="overflow-hidden">
        <Table aria-label="Preços por rede">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-56">Produto</TableHead>
              {redes!.map((r) => <TableHead key={r.id} className="min-w-56">{r.nome}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtos!.map((p) => (
              <TableRow key={p.id} className="hover:bg-transparent">
                <TableCell>
                  <span className="font-medium text-foreground">{p.descricao}</span>{' '}
                  <span className="text-sm text-muted">({p.codigo} · {p.unidade})</span>
                </TableCell>
                {redes!.map((r) => {
                  const v = vigente(r.id, p.id);
                  const aberto = hGrupo === r.id && hProduto === p.id;
                  return (
                    <TableCell key={r.id} className={cn(aberto && 'bg-brand-soft')}>
                      <form action={definirPreco.bind(null, id, r.id, p.id)} className="flex items-center gap-1">
                        <span className="relative">
                          <span aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
                          <Input
                            name="valor"
                            inputMode="decimal"
                            defaultValue={v ? valorCampo(Number(v.valor)) : ''}
                            disabled={!podeEditar}
                            aria-label={`Preço de ${p.descricao} para ${r.nome}`}
                            className="tabular h-8 w-28 pl-8 text-right text-sm"
                          />
                        </span>
                        {podeEditar && (
                          <button
                            type="submit"
                            aria-label={`Salvar preço de ${p.descricao} para ${r.nome}`}
                            title="Salvar"
                            className={cn(variantesBotao({ variant: 'outline', size: 'icon' }), 'size-8')}
                          >
                            <Check aria-hidden size={16} strokeWidth={1.75} />
                          </button>
                        )}
                        <Link
                          href={`/clientes/${id}?aba=precos&historico=${r.id}:${p.id}`}
                          scroll={false}
                          aria-label={`histórico de ${p.descricao} para ${r.nome}`}
                          title="Ver histórico"
                          className={cn(variantesBotao({ variant: 'ghost', size: 'icon' }), 'size-8 text-muted')}
                        >
                          <History aria-hidden size={16} strokeWidth={1.75} />
                        </Link>
                        {v?.origem === 'agente' && (
                          <span title="Preço vigente definido pelo agente IA" className="inline-flex items-center gap-0.5 text-xs text-assistant">
                            <Bot aria-hidden size={14} strokeWidth={1.75} />
                            <span>IA</span>
                          </span>
                        )}
                      </form>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {linhasHistorico && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle>Histórico de preço</CardTitle>
              {redeHist && produtoHist && <CardDescription>{produtoHist.descricao} para {redeHist.nome}</CardDescription>}
            </div>
            <Link href={`/clientes/${id}?aba=precos`} scroll={false} aria-label="Fechar histórico" title="Fechar histórico" className={cn(variantesBotao({ variant: 'ghost', size: 'icon' }), 'size-8')}>
              <X aria-hidden size={16} strokeWidth={1.75} />
            </Link>
          </CardHeader>
          <CardContent>
            {linhasHistorico.length === 0 && <p className="text-sm text-muted">Sem preços registrados.</p>}
            <ol className="flex flex-col gap-2">
              {linhasHistorico.map((h, i) => {
                const agente = h.origem === 'agente';
                const Icone = agente ? Bot : UserRound;
                return (
                  <li key={i} className={cn('flex items-start gap-2 text-base', h.vigente_ate ? 'text-muted' : 'text-foreground')}>
                    <Icone aria-hidden size={16} strokeWidth={1.75} className={cn('mt-0.5 shrink-0', agente ? 'text-assistant' : 'text-muted')} />
                    <span className="tabular">
                      {reais(Number(h.valor))}{h.vigente_ate ? '' : ' · vigente'} · desde {data(h.vigente_desde)}{h.vigente_ate ? ` até ${data(h.vigente_ate)}` : ''}{agente ? ` · alterado pelo agente IA${h.contatos?.nome ? ` (a pedido de ${h.contatos.nome})` : ''}` : h.usuarios?.nome ? ` · por ${h.usuarios.nome}` : ' · pelo painel'}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
