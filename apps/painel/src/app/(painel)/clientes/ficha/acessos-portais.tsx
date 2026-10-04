'use client';

import { Copy, Eye, EyeOff, Lock, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition, type FormEvent, type ReactElement } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { FormField } from '@/components/patterns/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { classeCaixa } from '../estilos';
import { copiarAcesso, removerAcesso, revelarAcesso, salvarAcesso, type EstadoAcesso } from './acessos-acoes';
import { SEM_CHAVE, SEM_PERMISSAO_VER } from './acessos-textos';
import { BlocoFicha } from './campos';

export type AcessoLinha = { id: string; portal: string; usuario: string | null; tem_senha: boolean };
/** A senha revelada some sozinha (D5). */
const MOSTRAR_POR_MS = 30_000;
// Textos fixos para falha da chamada: o erro em si nunca vai para a tela.
const NAO_ABRIU = 'Não consegui abrir a senha agora. Tente de novo.';
const NAO_SALVOU = 'Não consegui salvar o acesso agora. Tente de novo.';
const NAO_REMOVEU = 'Não consegui remover o acesso agora. Tente de novo.';

/**
 * Acessos de portais (spec 7D.1 item 8). Portal e usuário à vista de quem vê a ficha (D7); a senha só chega à tela por
 * "Revelar" (some em 30 s) ou vai direto para a área de transferência por "Copiar" — as duas passam pela auditoria (D5).
 */
export function AcessosPortais({ clienteId, acessos, podeVer, podeEditar, cofreOk }: {
  clienteId: string | null; acessos: AcessoLinha[]; podeVer: boolean; podeEditar: boolean; cofreOk: boolean;
}) {
  return (
    <BlocoFicha id="acessos" titulo="Acessos de portais"
      aside={<span className="inline-flex items-center gap-1"><Lock aria-hidden size={12} strokeWidth={1.75} />só com a permissão &quot;Ver acessos de portais&quot;</span>}>
      <p className="mb-3 flex items-start gap-3 rounded-lg bg-grafite px-4 py-3 text-sm text-grafite-foreground">
        <ShieldCheck aria-hidden size={20} strokeWidth={1.75} className="shrink-0 text-champagne" />
        Guardado criptografado. Revelar uma senha fica registrado na auditoria. O agente e o assistente nunca recebem estes dados.
      </p>
      {!clienteId ? <p className="text-sm text-muted">Salve a ficha para cadastrar acessos.</p> : (
        <>
          {!cofreOk && <p className="mb-3 text-sm font-bold text-warning">{SEM_CHAVE}</p>}
          {!podeVer && acessos.some((a) => a.tem_senha) && (
            <p className="mb-3 text-sm text-muted">Revelar e copiar só com a permissão &quot;Ver acessos de portais&quot;.</p>
          )}
          {acessos.length === 0 ? <p className="text-sm text-muted">Nenhum acesso cadastrado.</p> : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-xs font-extrabold uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left">Portal</th>
                    <th scope="col" className="px-3 py-2 text-left">Usuário</th>
                    <th scope="col" className="px-3 py-2 text-left">Senha</th>
                    <th scope="col"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {acessos.map((a) => <LinhaAcesso key={a.id} clienteId={clienteId} a={a} podeVer={podeVer} podeEditar={podeEditar} cofreOk={cofreOk} />)}
                </tbody>
              </table>
            </div>
          )}
          {/* Cadastrar pede "Ver e editar" em Clientes e "Ver acessos de portais" (D6), e a chave no ambiente (D8). */}
          {podeEditar && podeVer && cofreOk && (
            <JanelaAcesso clienteId={clienteId} gatilho={(
              <Button type="button" variant="link" className="mt-3"><Plus aria-hidden size={16} strokeWidth={1.75} />Adicionar acesso</Button>
            )} />
          )}
        </>
      )}
    </BlocoFicha>
  );
}

function LinhaAcesso({ clienteId, a, podeVer, podeEditar, cofreOk }: {
  clienteId: string; a: AcessoLinha; podeVer: boolean; podeEditar: boolean; cofreOk: boolean;
}) {
  const router = useRouter();
  const [senha, setSenha] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  useEffect(() => {
    if (senha === null) return;
    const t = setTimeout(() => setSenha(null), MOSTRAR_POR_MS);
    return () => clearTimeout(t);
  }, [senha]);
  const motivo = !podeVer ? SEM_PERMISSAO_VER : !cofreOk ? SEM_CHAVE : null;

  // Falha da ação (rede, 500) vira aviso na linha: sem o catch, o React 19 troca a ficha inteira pela tela de erro.
  const revelar = () => iniciar(async () => {
    try {
      const r = await revelarAcesso(a.id);
      if (r.ok) { setSenha(r.senha); setErro(null); } else setErro(r.erro);
    } catch (err) {
      unstable_rethrow(err);
      setErro(NAO_ABRIU);
    }
  });
  const copiar = () => iniciar(async () => {
    let r: Awaited<ReturnType<typeof copiarAcesso>>;
    try {
      r = await copiarAcesso(a.id);
    } catch (err) {
      unstable_rethrow(err);
      setErro(NAO_ABRIU);
      return;
    }
    if (!r.ok) { setErro(r.erro); return; }
    try {
      await navigator.clipboard.writeText(r.senha);
      setErro(null);
      toast.success('Senha copiada.');
    } catch {
      setErro('Não consegui copiar. Use Revelar.');
    }
  });

  return (
    <tr className="border-t border-border align-middle">
      <th scope="row" className="px-3 py-2 text-left font-bold text-foreground">{a.portal}</th>
      <td className="px-3 py-2 text-foreground">{a.usuario ?? '—'}</td>
      <td className="px-3 py-2">
        {!a.tem_senha ? <span className="text-muted">—<span className="sr-only">sem senha</span></span>
          : senha !== null ? <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-foreground">{senha}</code>
            : <span className="tracking-widest text-foreground"><span aria-hidden>••••••••</span><span className="sr-only">senha guardada</span></span>}
        {erro && <p role="alert" className="mt-1 text-xs text-danger">{erro}</p>}
      </td>
      <td className="whitespace-nowrap px-2 py-1 text-right">
        {a.tem_senha && (
          <>
            <Button type="button" variant="ghost" size="icon" disabled={Boolean(motivo) || ocupado} title={motivo ?? undefined}
              aria-label={senha !== null ? `Esconder a senha de ${a.portal}` : `Revelar a senha de ${a.portal}`}
              onClick={senha !== null ? () => setSenha(null) : revelar}>
              {senha !== null ? <EyeOff aria-hidden size={16} strokeWidth={1.75} /> : <Eye aria-hidden size={16} strokeWidth={1.75} />}
            </Button>
            <Button type="button" variant="ghost" size="icon" disabled={Boolean(motivo) || ocupado} title={motivo ?? undefined}
              aria-label={`Copiar a senha de ${a.portal}`} onClick={copiar}>
              <Copy aria-hidden size={16} strokeWidth={1.75} />
            </Button>
          </>
        )}
        {podeEditar && podeVer && cofreOk && (
          <JanelaAcesso clienteId={clienteId} acesso={a} gatilho={(
            <Button type="button" variant="ghost" size="icon" aria-label={`Editar o acesso ${a.portal}`}><Pencil aria-hidden size={16} strokeWidth={1.75} /></Button>
          )} />
        )}
        {/* Remover também pede a permissão (D6, o banco recusa sem ela), mas continua sem a chave (D8). */}
        {podeEditar && podeVer && (
          <ConfirmDialog tipo="excluir" titulo={`Remover o acesso ${a.portal}?`} descricao="A senha guardada sai junto. Fica registrado na auditoria." confirmar="Remover"
            gatilho={<Button type="button" variant="ghost" size="icon" aria-label={`Remover o acesso ${a.portal}`}><Trash2 aria-hidden size={16} strokeWidth={1.75} /></Button>}
            acao={async () => {
              try {
                const r = await removerAcesso(clienteId, a.id);
                if (r.ok) { toast.success('Acesso removido.'); router.refresh(); } else toast.error(r.erro);
              } catch (err) {
                unstable_rethrow(err);
                toast.error(NAO_REMOVEU);
              }
            }} />
        )}
      </td>
    </tr>
  );
}

function JanelaAcesso({ clienteId, acesso, gatilho }: { clienteId: string; acesso?: AcessoLinha; gatilho: ReactElement }) {
  const router = useRouter();
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<EstadoAcesso | null>(null);
  const [semSenha, setSemSenha] = useState(acesso ? !acesso.tem_senha : false);
  const [salvando, iniciar] = useTransition();
  const erros = estado && !estado.ok ? estado.erros : {};

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // A janela é um portal dentro do formulário da ficha: este envio não sobe até ele (D13).
    e.stopPropagation();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await salvarAcesso(clienteId, acesso?.id ?? null, dados);
        setEstado(r);
        if (!r.ok) return;
        setAberto(false);
        toast.success('Acesso salvo.');
        router.refresh();
      } catch (err) {
        unstable_rethrow(err);
        setEstado({ ok: false, erros: { geral: NAO_SALVOU } });
      }
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) setEstado(null); }}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{acesso ? `Editar acesso: ${acesso.portal}` : 'Novo acesso de portal'}</DialogTitle>
          <DialogDescription>A senha é guardada cifrada. O agente e o assistente nunca recebem estes dados.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" autoComplete="off">
          {erros.geral && <p role="alert" className="text-sm text-danger">{erros.geral}</p>}
          <FormField id={`${id}-portal`} rotulo="Portal" obrigatorio erro={erros.portal}>
            <Input name="portal" defaultValue={acesso?.portal ?? ''} maxLength={80} placeholder="Ex.: SEFAZ-MG" />
          </FormField>
          <FormField id={`${id}-usuario`} rotulo="Usuário" erro={erros.usuario}>
            <Input name="usuario" defaultValue={acesso?.usuario ?? ''} maxLength={120} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-form-type="other" />
          </FormField>
          <FormField id={`${id}-senha`} rotulo="Senha" erro={erros.senha} ajuda={acesso?.tem_senha ? 'Em branco: continua a senha guardada.' : undefined}>
            <Input name="senha" type="password" autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-form-type="other" maxLength={200}
              disabled={semSenha} />
          </FormField>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" name="sem_senha" className={classeCaixa} checked={semSenha} onChange={(e) => setSemSenha(e.currentTarget.checked)} />
            Sem senha (ex.: entra pelo certificado)
          </label>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={salvando}>Salvar acesso</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
