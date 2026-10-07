import { Bot, CirclePause, UserRoundPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { avisoDaLista, lerEmpresasAtivasDoSeletor } from '@/lib/listas-ativas';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarAgenteContato, cadastrarContatoDaConversa } from '../acoes';
import { BotaoCadastrarContato, FormCadastroContato } from '@/components/patterns/form-cadastro-contato';

const campo = 'mt-1 h-8 w-full rounded-md border border-input bg-surface px-2 text-base text-foreground shadow-sm';

/**
 * Número não cadastrado: cadastra o contato (com ou sem empresa) e escolhe se o agente atende.
 * Contato cadastrado: liga ou desliga o agente só para ele (desligado = nada automático; vira triagem).
 */
export async function ContatoDaConversa({ conversaId, contato, pode }: {
  conversaId: string; contato: { id: string; nome: string; agente_pausado: boolean } | null; pode: boolean;
}) {
  if (contato) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-base font-medium text-foreground">{contato.nome}</p>
        <p className={`flex items-center gap-1.5 ${contato.agente_pausado ? 'text-agent-paused' : 'text-agent-active'}`}>
          {contato.agente_pausado
            ? <CirclePause aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
            : <Bot aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />}
          {contato.agente_pausado ? 'Agente desligado para este contato' : 'O agente atende este contato'}
        </p>
        {pode && (
          <form action={alternarAgenteContato.bind(null, contato.id, conversaId, contato.agente_pausado)}>
            <Button size="sm" variant="outline">
              {contato.agente_pausado ? 'Ligar o agente para este contato' : 'Desligar o agente para este contato'}
            </Button>
          </form>
        )}
      </div>
    );
  }

  const sb = await supabaseServidor();
  // Revisão geral (painel I4): só quem pode cadastrar vê o seletor; em páginas, sem o corte de 1000 do PostgREST.
  const lista = pode ? await lerEmpresasAtivasDoSeletor(sb) : { linhas: [], parcial: false, erro: false };
  const aviso = avisoDaLista(lista, 'empresas');
  return (
    <div className="rounded-md border border-warning bg-warning-soft p-3 text-sm text-foreground">
      <p className="mb-2 flex items-center gap-1.5 font-semibold text-warning">
        <UserRoundPlus aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
        Contato não cadastrado
      </p>
      {!pode && <p className="text-muted">Peça a alguém com a permissão &quot;Editar clientes&quot; para cadastrar este número.</p>}
      {pode && (
        <FormCadastroContato action={cadastrarContatoDaConversa.bind(null, conversaId)} conversaId={conversaId} className="flex flex-col gap-2">
          <label className="block font-medium">Nome do contato<input name="nome" required minLength={2} className={campo} /></label>
          <label className="block font-medium">Empresa (opcional)
            <select name="cliente_id" defaultValue="" className={campo}>
              <option value="">Sem empresa</option>
              {lista.linhas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </label>
          {aviso && <p role="status" className="text-sm text-warning">{aviso}</p>}
          <label className="flex items-center gap-2"><input type="checkbox" name="pode_pedir_nota" className="size-4 accent-brand" /> Pode pedir nota</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="agente_atende" defaultChecked className="size-4 accent-brand" /> O agente atende este contato</label>
          <BotaoCadastrarContato size="sm" className="self-start">Cadastrar contato</BotaoCadastrarContato>
        </FormCadastroContato>
      )}
    </div>
  );
}
