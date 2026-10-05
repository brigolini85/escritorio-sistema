'use client';
import { useRouter } from 'next/navigation';
import type { SkillTela } from '@/lib/agentes';

/** Escolha da skill do teste (D21): até as desligadas ("rascunho"), só para o dono. */
export function TestarSkill({ slug, skills, atual }: { slug: string; skills: SkillTela[]; atual: string | null }) {
  const router = useRouter();
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">Testar com a skill
      <select value={atual ?? ''} onChange={(e) => router.push(`/agentes/${slug}/testar${e.target.value ? `?skill=${e.target.value}` : ''}`)}
        className="h-9 rounded-md border border-input bg-surface px-2 text-sm font-normal">
        <option value="">Só as ligadas (como o Thiago está agora)</option>
        {skills.map((s) => <option key={s.id} value={s.id}>{s.titulo}{s.ativo ? '' : ' (desligada)'}</option>)}
      </select>
    </label>
  );
}
