'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import { INFO_TIPO_SKILL, TIPOS_SKILL, type TipoSkill } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { subirSkill } from '@/lib/skills-acoes';

type Escolhido = { arquivo: File; caminho: string };

/** SUBIR SKILL (spec 7E.3, D8): pasta, .zip ou .md; o tipo do cabeçalho vence; sem ele, vale o escolhido aqui. */
export function SubirSkill({ slug }: { slug: string }) {
  const router = useRouter();
  const pasta = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<TipoSkill | null>(null);
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  // webkitdirectory não é atributo conhecido do React: liga direto no elemento.
  useEffect(() => { pasta.current?.setAttribute('webkitdirectory', ''); }, []);
  const escolher = (lista: FileList | null) => {
    setEscolhidos([...(lista ?? [])].map((f) => ({ arquivo: f, caminho: f.webkitRelativePath || f.name })));
    setAviso(null);
  };
  const subir = () => iniciar(async () => {
    const fd = new FormData();
    // F7: o Next descarta a parte de pasta do nome do File; o caminho segue num campo paralelo, na mesma ordem.
    for (const e of escolhidos) fd.append('arquivos', e.arquivo);
    for (const e of escolhidos) fd.append('caminhos', e.caminho);
    fd.append('tipo', tipo ?? '');
    const r = await subirSkill(slug, fd);
    if (r.ok) {
      toast(r.nova ? `Skill ${r.titulo} subida (desligada).` : `Skill ${r.titulo}: versão ${r.versao}.`);
      setEscolhidos([]); setAviso(null); router.refresh();
      return;
    }
    setAviso('precisaTipo' in r ? `O SKILL.md de "${r.titulo}" não diz o tipo: escolha um abaixo e clique em Subir skill de novo.` : r.erro);
  });
  return (
    <section id="subir" aria-label="Subir skill" className="flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-border p-4 text-center text-sm"
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); escolher(e.dataTransfer.files); }}>
      <p className="flex items-center gap-2"><CloudUpload aria-hidden size={16} />Arraste aqui um <b>.zip</b> ou um <b>.md</b>, ou escolha uma <b>pasta</b>:</p>
      <div className="flex gap-2">
        <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 font-bold">Escolher pasta
          <input ref={pasta} type="file" multiple className="sr-only" onChange={(e) => escolher(e.target.files)} /></label>
        <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 font-bold">Escolher .zip ou .md
          <input type="file" accept=".zip,.md" className="sr-only" onChange={(e) => escolher(e.target.files)} /></label>
      </div>
      <div role="radiogroup" aria-label="Tipo da skill" className="flex flex-wrap justify-center gap-1">
        {[...TIPOS_SKILL].sort((a, b) => INFO_TIPO_SKILL[a].ordem - INFO_TIPO_SKILL[b].ordem).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(tipo === t ? null : t)}
            className={cn('rounded-md border px-3 py-1 text-xs font-bold uppercase', tipo === t ? 'border-brand bg-brand text-brand-foreground' : 'border-border bg-surface')}>
            {INFO_TIPO_SKILL[t].rotulo}
          </button>
        ))}
      </div>
      {escolhidos.length > 0 && <p className="text-muted">{escolhidos.length === 1 ? escolhidos[0]!.caminho : `${escolhidos.length} arquivos escolhidos`}</p>}
      {aviso && <p role="alert" className="text-danger">{aviso}</p>}
      <Button onClick={subir} disabled={!escolhidos.length || enviando}>Subir skill</Button>
      <p className="text-xs text-muted">Mesmo formato das skills do Claude (SKILL.md + referências); o tipo vai no cabeçalho do arquivo (<code>tipo: limites</code>). Referências: .md, .txt ou .csv.</p>
    </section>
  );
}
