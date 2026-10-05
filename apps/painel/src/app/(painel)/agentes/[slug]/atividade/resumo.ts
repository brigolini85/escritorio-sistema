import { percentual } from '@/lib/gastos';

export type LinhaAtividade = { dia: string; atendimentos: number | string; resolvidos: number | string; custo_usd: number | string; custo_testes_usd: number | string };

export function resumirAtividade(linhas: LinhaAtividade[]) {
  const soma = (f: (l: LinhaAtividade) => number | string) => linhas.reduce((s, l) => s + (Number(f(l)) || 0), 0);
  const atendimentos = soma((l) => l.atendimentos);
  const resolvidos = soma((l) => l.resolvidos);
  return {
    atendimentos, resolvidos, passagens: atendimentos - resolvidos,
    custoUsd: Math.round(soma((l) => l.custo_usd) * 1e6) / 1e6, custoTestesUsd: Math.round(soma((l) => l.custo_testes_usd) * 1e6) / 1e6,
    sozinho: atendimentos ? percentual(resolvidos, atendimentos) : null,
  };
}
