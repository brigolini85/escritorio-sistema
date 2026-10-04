import { cn } from '@/lib/cn';
import { estadoDaConversa, textoAtendimentos, textoConversaAgora, textoResolvidas, textoUltimoContato } from '@/lib/contatos';
import type { WhatsappDoContato } from './dados-contatos';
import { SecaoPainel } from './secao-painel';

/** Bloco WhatsApp (imagem A): último contato, conversa agora e a % resolvida pelo agente, com "N atendimentos" no título (D3). */
export function BlocoWhatsapp({ w, euId, veTodas, agora }: { w: WhatsappDoContato; euId: string; veTodas: boolean; agora: Date }) {
  const ctx = { euId, veTodas };
  const espera = estadoDaConversa(w, ctx).tom === 'espera';
  const linhas = [
    { rotulo: 'Último contato', valor: textoUltimoContato(w.ultimaEm, agora), classe: 'tabular font-semibold text-foreground' },
    { rotulo: 'Conversa agora', valor: textoConversaAgora(w, ctx, agora), classe: espera ? 'font-semibold text-warning' : 'text-foreground' },
    { rotulo: 'Resolvidas pelo agente', valor: textoResolvidas(w.resumo), classe: 'tabular text-foreground' },
  ];
  return (
    <SecaoPainel titulo="WhatsApp" extra={textoAtendimentos(w.resumo)}>
      <dl className="flex flex-col gap-1">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-3 text-base">
            <dt className="text-muted">{l.rotulo}</dt>
            <dd className={cn('text-right', l.classe)}>{l.valor}</dd>
          </div>
        ))}
      </dl>
    </SecaoPainel>
  );
}
