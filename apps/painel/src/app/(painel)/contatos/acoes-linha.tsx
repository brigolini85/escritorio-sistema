'use client';

import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { PermissionGate } from '@/components/patterns/permission-gate';
import { Button, variantesBotao } from '@/components/ui/button';
import { hrefConversa } from '@/lib/contatos';

/** Por que o "Abrir conversa" está desligado (D8). */
export function motivoSemConversa(podeConversa: boolean): string {
  return podeConversa
    ? 'Nenhuma conversa com este contato que você possa abrir. A conversa começa quando ele escreve no WhatsApp.'
    : 'Atendimento: Sem acesso. Peça ao administrador na aba Usuários.';
}

/** Abrir conversa: ícone na linha; botão com texto no painel (`grande`). Sem conversa visível ou sem Atendimento: desligado. */
export function BotaoAbrirConversa({ conversaId, nome, podeConversa, grande = false }: {
  conversaId: string | null; nome: string; podeConversa: boolean; grande?: boolean;
}) {
  const rotulo = `Abrir a conversa com ${nome}`;
  const icone = <MessageCircle aria-hidden size={16} strokeWidth={1.75} />;
  const conteudo = grande ? <>{icone}Abrir conversa</> : icone;
  if (conversaId && podeConversa) {
    return (
      <Link href={hrefConversa(conversaId)} aria-label={grande ? undefined : rotulo} title={rotulo}
        className={variantesBotao(grande ? { variant: 'primary', size: 'sm' } : { variant: 'outline', size: 'icon' })}>
        {conteudo}
      </Link>
    );
  }
  return (
    <PermissionGate permitido={false} modo="desabilitar" motivo={motivoSemConversa(podeConversa)}>
      <Button type="button" variant={grande ? 'primary' : 'outline'} size={grande ? 'sm' : 'icon'} aria-label={grande ? undefined : rotulo}>{conteudo}</Button>
    </PermissionGate>
  );
}

/** Ações da linha (spec 7C.2, D6): abrir conversa e arquivar (só com "Editar e arquivar"; o banco confere de novo). */
export function AcoesLinhaContato({ id, nome, conversaId, podeConversa, podeArquivar }: {
  id: string; nome: string; conversaId: string | null; podeConversa: boolean; podeArquivar: boolean;
}) {
  return (
    <span className="flex items-center justify-end gap-1">
      <BotaoAbrirConversa conversaId={conversaId} nome={nome} podeConversa={podeConversa} />
      {podeArquivar && <ExcluirCadastro tipo="contato" id={id} nome={nome} />}
    </span>
  );
}
