import { Contact, FileText, MessageSquareText, Plus, Search, Sparkles, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { atalhosDaMesa, type Atalho } from '@/lib/minha-mesa';
import type { UsuarioPainel } from '@/lib/sessao';

const ICONE: Record<Atalho['icone'], LucideIcon> = {
  nova: Plus, empresa: Search, respostas: MessageSquareText, assistente: Sparkles, notas: FileText, contatos: Contact,
};

/** Atalhos (imagem B), só os que a pessoa pode usar (D17). */
export function AtalhosMesa({ u }: { u: UsuarioPainel }) {
  return (
    <Card className="gap-3 p-4">
      <h2 id="titulo-atalhos" className="text-sm font-bold uppercase tracking-wide text-brand">Atalhos</h2>
      <nav aria-labelledby="titulo-atalhos">
        <ul className="grid grid-cols-2 gap-2">
          {atalhosDaMesa(u).map((a) => {
            const Icone = ICONE[a.icone];
            return (
              <li key={a.href}>
                <Link href={a.href} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-muted">
                  <Icone aria-hidden size={16} strokeWidth={1.75} className="text-brand" />{a.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </Card>
  );
}
