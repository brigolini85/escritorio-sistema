/** Parte I3a (D17, D23): documentos fictícios dos cenários de tarefa. O Banco do Brasil de propósito não existe. */
export const EXTRATO_ITAU = `Banco Itaú - Extrato conta corrente 1234-5 - Padaria Sol ME - outubro/2026
data;historico;documento;valor;saldo
01/10/2026;SALDO ANTERIOR;;;15.230,40
02/10/2026;RECEB CARTAO CIELO;;8.450,00;23.680,40
05/10/2026;TARIFA PACOTE SERVICOS;;-45,00;23.635,40
07/10/2026;PAGTO FORNECEDOR MOINHO BOM TRIGO;NF 3321;-6.120,00;17.515,40
10/10/2026;FOLHA DE PAGAMENTO;;-9.800,00;7.715,40
12/10/2026;PIX ENVIADO ROBERTO FARIA;;-3.200,00;4.515,40
15/10/2026;RECEB CARTAO CIELO;;9.120,00;13.635,40
20/10/2026;DAS SIMPLES NACIONAL;;-1.980,55;11.654,85
22/10/2026;PAG*MANUTENCAOFRIO;;-480,00;11.174,85
31/10/2026;SALDO FINAL;;;11.174,85
`;

export const FOLHA_OUTUBRO = `Folha de pagamento - Padaria Sol ME - outubro/2026
funcionario;cargo;liquido
Ana Souza;Atendente;2.450,00
Bruno Lima;Padeiro;3.100,00
Carla Dias;Confeiteira;2.750,00
Diego Rocha;Auxiliar;1.500,00
total;;9.800,00
`;

export const SOCIOS = `Contrato social (resumo) - Padaria Sol ME
Sócios: Roberto Faria (50%) e Marina Faria (50%).
Pró-labore: não consta valor no contrato.
Contas bancárias da empresa: Itaú (conta 1234-5) e Banco do Brasil (conta 9876-0).
`;

export const PROCEDIMENTO_FECHAMENTO = `# Fechamento mensal (prévia)

Use para a prévia do fechamento do mês de um cliente do Simples Nacional.

## Etapas
1. Coletar documentos — confira se há extrato de todas as contas da empresa, a folha e o contrato social
2. Ler e lançar — classifique cada saída e entrada do extrato
3. Conciliar — confira o saldo final do extrato
4. Revisar pendências — o que não tem documento ou classificação vira pendência

## Regras
- Conta da empresa sem extrato: pendência do cliente pedindo o extrato do mês.
- Saída para sócio sem pró-labore na folha: pergunte ao analista se é pró-labore, distribuição de lucro ou empréstimo.
- Despesa sem nota: pergunte ao analista a classificação.
`;

export const LIMITES_CONTABIL = `# Limites do Contábil

- Nunca invente valores: todo número vem de um documento lido ou de uma resposta da equipe.
- Nunca calcule saldo de conta sem o extrato daquela conta.
- Nunca classifique retirada de sócio sem a confirmação do analista.
`;
