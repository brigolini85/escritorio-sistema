import { Building2, SearchX, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { DocumentText } from '@/components/patterns/document-text';
import { EmptyState } from '@/components/patterns/empty-state';
import { SwitchAgenteContato } from '@/components/patterns/switch-agente-contato';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SheetBody, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarAgenteContato } from '../atendimento/acoes';
import { anonimizarContato } from '../clientes/acoes';
import { MarcacoesContato, nomeEmpresa, type Vinculo } from './marcacoes';

/** Nome que o banco põe no contato depois de apagar os dados (anonimizar_contato). */
const NOME_ANONIMIZADO = 'Contato removido';

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">{titulo}</h3>
      {children}
    </section>
  );
}

/** Conteúdo do painel lateral do contato (?contato=<id>): empresas e marcações, agente e a zona de perigo (LGPD). */
export async function DetalheContato({ id, pode, admin }: { id: string; pode: boolean; admin: boolean }) {
  const sb = await supabaseServidor();
  const { data: c } = await sb.from('contatos')
    .select('id, nome, telefone, agente_pausado, ativo, contato_clientes(pode_pedir_nota, pode_atualizar_preco, clientes(id, razao_social, nome_fantasia))')
    .eq('id', id).maybeSingle();

  if (!c) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Contato não encontrado</SheetTitle>
          <SheetDescription className="sr-only">O contato do endereço não existe mais.</SheetDescription>
        </SheetHeader>
        <SheetBody><EmptyState icone={SearchX} titulo="Não encontrei este contato." descricao="Ele pode ter sido apagado." /></SheetBody>
      </>
    );
  }

  const vinculos: Vinculo[] = c.contato_clientes.flatMap((v) => (v.clientes
    ? [{ empresaId: v.clientes.id, empresa: nomeEmpresa(v.clientes), podePedirNota: v.pode_pedir_nota, podeMudarPreco: v.pode_atualizar_preco }]
    : []));
  const anonimizado = c.nome === NOME_ANONIMIZADO && !c.ativo;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{c.nome}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          <DocumentText valor={c.telefone} tipo="telefone" />
          {!c.ativo && <Badge variant="neutral">Inativo</Badge>}
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <Secao titulo="Agente">
          <SwitchAgenteContato
            acao={alternarAgenteContato.bind(null, c.id, null, c.agente_pausado)}
            desligado={c.agente_pausado}
            nome={c.nome}
            pode={pode}
            mostrarEstado
          />
          <p className="text-sm text-muted">Desligado, nada é respondido automaticamente para este contato: a conversa vai para a equipe.</p>
        </Secao>

        <Secao titulo={`Empresas (${vinculos.length})`}>
          {vinculos.length === 0 ? (
            <p className="text-sm text-muted">Sem empresa. Para ligar a uma empresa, abra a empresa em Clientes, aba Contatos, e use &quot;Vincular contato já cadastrado&quot;.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {vinculos.map((v) => (
                <li key={v.empresaId} className="flex flex-col gap-1 rounded-md border border-border p-3">
                  <Link href={`/clientes/${v.empresaId}?aba=contatos`} className="flex items-center gap-2 font-medium text-foreground hover:underline">
                    <Building2 aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
                    {v.empresa}
                  </Link>
                  <MarcacoesContato vinculos={[v]} vazio={<span className="text-sm text-muted">Só conversa (não pede nota nem muda preço)</span>} />
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {admin && !anonimizado && (
          <section aria-labelledby="zona-perigo" className="my-4 flex flex-col gap-2 rounded-md border border-danger p-4">
            <h3 id="zona-perigo" className="flex items-center gap-2 text-base font-semibold text-danger">
              <ShieldAlert aria-hidden size={16} strokeWidth={1.75} />
              Zona de perigo
            </h3>
            <p className="text-sm text-foreground">
              Apagar os dados a pedido do titular (LGPD): nome, telefone, mensagens, áudios e arquivos deste contato somem de vez, em todas as empresas. Não dá para desfazer.
            </p>
            <ConfirmDialog
              gatilho={<Button type="button" variant="danger" size="sm" className="self-start">Apagar dados (LGPD)</Button>}
              titulo={`Apagar os dados de ${c.nome}?`}
              descricao="Esta ação não pode ser desfeita. As conversas ficam, mas sem o conteúdo."
              confirmar="Apagar dados"
              enviando="Apagando…"
              digitarParaConfirmar={c.nome}
              acao={anonimizarContato.bind(null, vinculos[0]?.empresaId ?? '', c.id)}
            >
              <input type="hidden" name="confirmo" value="on" />
            </ConfirmDialog>
          </section>
        )}
        {admin && anonimizado && <p className="my-4 text-sm text-muted">Os dados deste contato já foram apagados a pedido do titular.</p>}
      </SheetBody>
    </>
  );
}

export function EsqueletoContato() {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="sr-only">Carregando o contato</SheetTitle>
        <SheetDescription className="sr-only">Os detalhes aparecem em instantes.</SheetDescription>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-32" />
      </SheetHeader>
      <SheetBody role="status" aria-label="Carregando o contato" className="flex flex-col gap-4 py-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </SheetBody>
    </>
  );
}
