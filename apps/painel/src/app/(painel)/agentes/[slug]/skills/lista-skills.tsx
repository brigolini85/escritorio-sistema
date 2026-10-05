'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Archive, Play } from 'lucide-react';
import { toast } from 'sonner';
import { INFO_TIPO_SKILL } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { SkillTela } from '@/lib/agentes';
import { cn } from '@/lib/cn';
import { formatarData } from '@/lib/formatos';
import { alternarSkill, arquivarSkill } from '@/lib/skills-acoes';
import { gruposDeSkills, textoDeUso } from './uso';
import { VersoesSkill } from './versoes-skill';

/** Skills por tipo (spec 7E.3, imagem 00-agente-ficha): cada grupo diz quando o agente lê. */
export function ListaSkills({ slug, porta, skills, uso, dono }: { slug: string; porta: boolean; skills: SkillTela[]; uso: Record<string, number>; dono: boolean }) {
  const router = useRouter();
  const [arquivando, setArquivando] = useState<SkillTela | null>(null);
  const [enviando, iniciar] = useTransition();
  const mapaUso = new Map(Object.entries(uso));
  const alternar = (s: SkillTela, ativo: boolean) => iniciar(async () => {
    const r = await alternarSkill(s.id, ativo);
    if (r.ok) { toast(`${s.titulo} ${ativo ? 'ligada' : 'desligada'}.`); router.refresh(); } else toast.error(r.erro);
  });
  const arquivar = (s: SkillTela) => iniciar(async () => {
    const r = await arquivarSkill(s.id);
    setArquivando(null);
    if (r.ok) { toast(`${s.titulo} arquivada.`); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <div className="flex flex-col gap-4">
      {gruposDeSkills(skills).map(({ tipo, skills: doTipo }) => {
        const info = INFO_TIPO_SKILL[tipo];
        return (
          <section key={tipo} aria-label={info.rotulo} className="flex flex-col">
            <header className="flex items-start justify-between gap-2 border-b border-border pb-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">{info.ordem} · {info.titulo}{' '}
                  <Badge variant={info.sempre ? (tipo === 'limites' ? 'danger' : 'brand') : 'info'} className="normal-case">{info.quando}</Badge></h3>
                <p className="text-sm text-muted">{info.explicacao}</p>
              </div>
              <span className="text-xs text-muted">{doTipo.length === 1 ? '1 skill' : `${doTipo.length} skills`}</span>
            </header>
            <ul>
              {doTipo.map((s) => (
                <li key={s.id} className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-border py-3', tipo === 'limites' && 'border-l-4 border-l-danger pl-3', !s.ativo && 'opacity-80')}>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">{s.titulo}
                      <Badge variant="warning">v{s.versao} · {formatarData(s.atualizadaEm)}</Badge>
                      {!s.ativo && <Badge variant="outline">desligada</Badge>}
                    </p>
                    <p className="text-sm text-muted">{s.descricao}</p>
                    <ul className="flex flex-wrap gap-1" aria-label={`Arquivos de ${s.titulo}`}>
                      {['SKILL.md', ...s.arquivos].map((a) => <li key={a}><code className="rounded-sm border border-border bg-surface-muted px-1.5 text-xs">{a}</code></li>)}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{textoDeUso(s, mapaUso)}</span>
                    <Switch checked={s.ativo} disabled={!dono || enviando} onCheckedChange={(v) => alternar(s, v)} aria-label={`Ligar ${s.titulo}`} />
                    <VersoesSkill skill={s} dono={dono} />
                    {porta && dono && (
                      <Link href={`/agentes/${slug}/testar?skill=${s.id}`} aria-label={`Testar ${s.titulo}`} className="inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-muted"><Play aria-hidden size={16} /></Link>
                    )}
                    {dono && <Button size="sm" variant="ghost" aria-label={`Arquivar ${s.titulo}`} onClick={() => setArquivando(s)}><Archive aria-hidden size={16} /></Button>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Dialog open={arquivando !== null} onOpenChange={(v) => { if (!v) setArquivando(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar <b>{arquivando?.titulo}</b>?</DialogTitle>
            <DialogDescription>Sai da lista e do agente. As versões ficam guardadas; subir de novo com o mesmo nome traz a skill de volta.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArquivando(null)}>Cancelar</Button>
            <Button variant="grafite" onClick={() => arquivando && arquivar(arquivando)} disabled={enviando}>Arquivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
