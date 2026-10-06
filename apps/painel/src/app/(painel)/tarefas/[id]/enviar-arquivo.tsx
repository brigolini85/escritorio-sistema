'use client';
import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { EXTENSOES_TAREFA } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { enviarArquivoTarefa } from '@/lib/tarefas-acoes';

/** D14: o arquivo entra na tarefa; devolve o id para quem chama (o "Já recebi" usa). */
export function EnviarArquivo({ tarefaId, aoEnviar, rotulo = 'Enviar arquivo' }: { tarefaId: string; aoEnviar?: (arquivoId: string) => void; rotulo?: string }) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [enviando, iniciar] = useTransition();
  const enviar = (f: File) => iniciar(async () => {
    const dados = new FormData();
    dados.set('arquivo', f);
    const r = await enviarArquivoTarefa(tarefaId, dados);
    if (!r.ok) { toast.error(r.erro); return; }
    toast(`${f.name} entrou na tarefa.`);
    aoEnviar?.(r.arquivoId);
    router.refresh();
  });
  return (
    <>
      <input ref={campo} type="file" className="sr-only" aria-label={rotulo} accept={EXTENSOES_TAREFA.map((e) => `.${e}`).join(',')}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); e.target.value = ''; }} />
      <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={() => campo.current?.click()}><Upload aria-hidden size={16} /> {rotulo}</Button>
    </>
  );
}
