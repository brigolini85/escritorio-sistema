import { ROTULO_DE_OPCAO } from '@/components/ui/rotulo-de-opcao';
import type { TipoOrientacao } from '@/lib/orientacoes';

/** Descrição de cada tipo nas opções do formulário (tela e "Ensinar o agente" do Atendimento). */
export const DESCRICAO_TIPO: Record<TipoOrientacao, string> = {
  jeito: 'Tom, cumprimento, tamanho das respostas.',
  regra: 'Prazos, horários e combinados que valem sempre.',
  situacao: 'O que fazer quando o cliente pede algo específico.',
};

/** Opção de rádio em cartão (tipo e "vale para" da orientação). */
export const classeOpcao = `${ROTULO_DE_OPCAO} flex cursor-pointer items-start gap-2 rounded-md border border-input bg-surface p-3 text-base has-checked:border-brand has-checked:bg-brand-soft`;
