'use client';

import { linkDaPasta } from '@escritorio/core';
import { CircleAlert, CircleCheck, ExternalLink, FolderOpen, LockKeyhole } from 'lucide-react';
import { useState, useTransition } from 'react';
import { FormField } from '@/components/patterns/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { TEXTO_DRIVE_SEM_I3B, TEXTO_PASTA_ERRO_LEITURA, avisoDoDrive, type SituacaoDrive } from '@/lib/drive-tela';
import { salvarPastaDrive } from './drive-acoes';

/**
 * D8: "Pasta no Drive" salva sozinha, como Acessos de portais. O campo fica fora do formulário da ficha (form= de um formulário que não existe):
 * não entra no envio da ficha nem conta como "não salvo".
 */
export function BlocoArquivos({ clienteId, pasta, situacao, podeEditar, semI3b, erroLeitura = false, erroSituacao = false }: {
  clienteId: string | null; pasta: string | null; situacao: SituacaoDrive | null; podeEditar: boolean; semI3b: boolean; erroLeitura?: boolean;
  /** Não consegui ler a situação do Drive (a pasta veio): o aviso diz isso, não "Drive não configurado". */ erroSituacao?: boolean;
}) {
  const [valor, setValor] = useState(pasta ? linkDaPasta(pasta) : '');
  const [salva, setSalva] = useState(pasta);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const aviso = avisoDoDrive(situacao, erroSituacao);
  const salvar = () => iniciar(async () => {
    if (!clienteId) return;
    const r = await salvarPastaDrive(clienteId, valor);
    if (!r.ok) { setErro(r.erro); return; }
    setErro(null);
    setSalva(r.pasta);
    setValor(r.pasta ? linkDaPasta(r.pasta) : '');
    toast.success(r.pasta ? 'Pasta no Drive salva.' : 'Pasta no Drive removida.');
  });
  return (
    <section id="bloco-arquivos" aria-labelledby="titulo-arquivos" className="scroll-mt-4 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="titulo-arquivos" tabIndex={-1} className="text-sm font-extrabold uppercase tracking-wide text-brand">Arquivos</h2>
        <Badge variant="neutral"><LockKeyhole aria-hidden size={12} />só leitura</Badge>
      </div>
      {erroLeitura ? (
        <p role="alert" className="text-sm text-warning">{TEXTO_PASTA_ERRO_LEITURA}</p>
      ) : semI3b || !clienteId ? (
        <p className="text-sm text-muted">{semI3b ? TEXTO_DRIVE_SEM_I3B : 'A pasta no Drive pode ser preenchida depois de salvar o cliente.'}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className={aviso.tom === 'success' ? 'flex items-start gap-2 text-sm text-success' : 'flex items-start gap-2 text-sm text-warning'}>
            {aviso.tom === 'success' ? <CircleCheck aria-hidden size={16} className="mt-0.5 shrink-0" /> : <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />}
            <span>{aviso.texto}</span>
          </p>
          <FormField id="ficha-pasta-drive" rotulo="Pasta no Drive" erro={erro ?? undefined}
            ajuda="Cole o link da pasta deste cliente no Google Drive. O agente só lê esta pasta e nunca altera nem apaga nada.">
            <Input form="sem-formulario-pasta-drive" value={valor} onChange={(e) => setValor(e.currentTarget.value)} disabled={!podeEditar || enviando}
              placeholder="https://drive.google.com/drive/folders/…" autoComplete="off" inputMode="url" />
          </FormField>
          <div className="flex flex-wrap items-center gap-2">
            {podeEditar && <Button type="button" size="sm" onClick={salvar} disabled={enviando}><FolderOpen aria-hidden size={16} />Salvar pasta</Button>}
            {salva && (
              <a href={linkDaPasta(salva)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand underline-offset-2 hover:underline">
                <ExternalLink aria-hidden size={14} />Abrir no Drive
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
