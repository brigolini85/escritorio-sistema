import { Bot, Building2, GraduationCap, HelpCircle, MessageCircle, Mic, Sparkles, WandSparkles, type LucideIcon } from 'lucide-react';
import { INFO_FUNCIONALIDADE } from '@/lib/gastos';
import { cn } from '@/lib/cn';

type Icone = (typeof INFO_FUNCIONALIDADE)[keyof typeof INFO_FUNCIONALIDADE]['icone'];

// Classes escritas por extenso: o Tailwind só gera o que encontra literal no código.
const ICONES: Record<Icone, { Icone: LucideIcon; cor: string }> = {
  robo: { Icone: Bot, cor: 'text-gasto-agente' },
  brilho: { Icone: Sparkles, cor: 'text-gasto-assistente-site' },
  whatsapp: { Icone: MessageCircle, cor: 'text-gasto-assistente-whatsapp' },
  varinha: { Icone: WandSparkles, cor: 'text-gasto-sugerir' },
  chapeu: { Icone: GraduationCap, cor: 'text-gasto-testar' },
  microfone: { Icone: Mic, cor: 'text-gasto-transcricao' },
  setor: { Icone: Building2, cor: 'text-gasto-especialista' },
  interrogacao: { Icone: HelpCircle, cor: 'text-gasto-nao-identificado' },
};

/** Ícone decorativo da funcionalidade (o nome vem sempre ao lado: a cor nunca fala sozinha). */
export function IconeFuncionalidade({ icone, className }: { icone: Icone; className?: string }) {
  const { Icone: Componente, cor } = ICONES[icone] ?? ICONES.interrogacao;
  return <Componente aria-hidden size={18} strokeWidth={1.75} className={cn('shrink-0', cor, className)} />;
}
