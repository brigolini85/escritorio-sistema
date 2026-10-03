'use client';

import { unstable_rethrow } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { FormField } from '@/components/patterns/form-field';
import { BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes } from '@/components/patterns/formulario-alteravel';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import type { ResultadoNome } from './acoes';

/** Nome do contato no painel lateral. Erro aparece no campo, sem perder o que foi digitado. */
export function EditarNomeContato({ nome, acao }: { nome: string; acao: (dados: FormData) => Promise<ResultadoNome> }) {
  const id = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    // Envio pela própria tela: o React não limpa o campo se a gravação falhar.
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await acao(dados);
        if (!r.ok) { setErro(r.erro); return; }
        setErro(null);
        toast.success(`Salvo: ${String(dados.get('nome') ?? '').trim()}.`);
      } catch (err) {
        unstable_rethrow(err);
        console.error('[contatos] falha ao salvar o nome', err);
        setErro('Não consegui salvar agora. Tente de novo.');
      }
    });
  };
  return (
    <FormularioAlteravel onSubmit={enviar} className="flex flex-col gap-3">
      <FormField id={`${id}-nome`} rotulo="Nome" erro={erro}>
        <Input name="nome" defaultValue={nome} required minLength={2} autoComplete="off" />
      </FormField>
      <div className="flex items-center justify-end gap-3">
        <IndicadorAlteracoes />
        <BotaoSalvar enviando={enviando} destacar size="sm">Salvar nome</BotaoSalvar>
      </div>
    </FormularioAlteravel>
  );
}
