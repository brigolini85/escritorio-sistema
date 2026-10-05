'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import { INFO_TIPO_SKILL, TIPOS_SKILL, type TipoSkill } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { escolherArquivosSkill, passaDoEnvio } from '@/lib/escolha-skill';
import { subirSkill } from '@/lib/skills-acoes';

type Escolhido = { arquivo: File; caminho: string; tamanho: number };
const FALHA_ENVIO = 'Não consegui enviar a skill. Tente de novo.';

/** SUBIR SKILL (spec 7E.3, D8): pasta, .zip ou .md; o tipo do cabeçalho vence; sem ele, vale o escolhido aqui. */
export function SubirSkill({ slug }: { slug: string }) {
  const router = useRouter();
  const pasta = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<TipoSkill | null>(null);
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [deFora, setDeFora] = useState<string[]>([]);
  const [enviando, iniciar] = useTransition();
  // webkitdirectory não é atributo conhecido do React: liga direto no elemento.
  useEffect(() => { pasta.current?.setAttribute('webkitdirectory', ''); }, []);
  const escolher = (lista: FileList | null) => {
    // PDF e outros formatos saem já aqui, com a frase do servidor (D7); o resto segue para Subir skill.
    const r = escolherArquivosSkill([...(lista ?? [])].map((f) => ({ arquivo: f, caminho: f.webkitRelativePath || f.name, tamanho: f.size })));
    setEscolhidos(r.escolhidos); setAviso(r.aviso); setDeFora(r.deFora);
  };
  const subir = () => iniciar(async () => {
    // Acima de 10 MB o servidor recusa (e acima de 15 MB o Next nem recebe): avisa sem mandar.
    if (passaDoEnvio(escolhidos)) { setAviso('Os arquivos passam de 10 MB: tire os maiores ou mande só o texto da skill.'); return; }
    const fd = new FormData();
    // F7: o Next descarta a parte de pasta do nome do File; o caminho segue num campo paralelo, na mesma ordem.
    for (const e of escolhidos) fd.append('arquivos', e.arquivo);
    for (const e of escolhidos) fd.append('caminhos', e.caminho);
    fd.append('tipo', tipo ?? '');
    let r: Awaited<ReturnType<typeof subirSkill>>;
    try {
      r = await subirSkill(slug, fd);
    } catch {
      // Falha de rede ou corpo recusado pelo Next: a aba continua de pé.
      setAviso(FALHA_ENVIO);
      return;
    }
    setDeFora([]);
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
      {deFora.length > 0 && <p className="text-xs text-muted">Ficaram de fora: {deFora.join(', ')}.</p>}
      <Button onClick={subir} disabled={!escolhidos.length || enviando}>Subir skill</Button>
      <p className="text-xs text-muted">Mesmo formato das skills do Claude (SKILL.md + referências); o tipo vai no cabeçalho do arquivo (<code>tipo: limites</code>). Referências: .md, .txt ou .csv.</p>
    </section>
  );
}
