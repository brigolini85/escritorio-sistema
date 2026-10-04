import { describe, expect, it } from 'vitest';
import {
  clienteDesde, diasAte, dinheiroNoCampo, estadoDosBlocos, etiquetasDoTopo, lerDinheiro, lerFicha, mensagemBusca, opcoesRegime,
  separarSetores, textoEstado, textoPreenchido, textoUltimaAlteracao, valorReajuste, valoresDe, valoresDoCliente,
} from './ficha';

const SETOR_FISCAL = '11111111-1111-4111-8111-111111111111';
const BIA = '22222222-2222-4222-8222-222222222222';
const SERVICO = '33333333-3333-4333-8333-333333333333';

function form(campos: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
// 10/10/2030 12:00 em São Paulo.
const AGORA = new Date('2030-10-10T15:00:00Z');

describe('lerFicha (D9, D13)', () => {
  it('lê a ficha inteira no formato de salvar_ficha_cliente', () => {
    const r = lerFicha(form({
      razao_social: ' Padaria Sol Comércio de Alimentos ME ', cnpj: '12.345.678/0001-95', nome_fantasia: 'Padaria Sol',
      inscricao_estadual: '0037486930064', regime: 'Simples Nacional', porte: 'me', faturamento_ultimo_ano: 'R$ 820.000,00', funcionarios: '8',
      segmentos: ['comercio', 'industria', 'atacado'], cep: '36.404-450', logradouro: 'Rua Rosa Figueiredo', numero: '430', uf: 'mg',
      telefone: '(31) 98780-0133', email: 'Contato@PadariaSol.com.br', contrato_inicio: '2022-03-01', honorario_mensal: '1.250,00',
      dia_vencimento: '10', reajuste: 'anual:3', decimo_terceiro: 'sim', certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-10-25',
      certificado_avisar_dias: '30', st_uf: ['SP', 'rj'], st_inscricao: ['123.456.789.110', ''], servico: [SERVICO, 'lixo'],
      [`responsavel:${SETOR_FISCAL}`]: BIA, agente_pausado: 'on',
    }), { admin: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados).toMatchObject({
      razao_social: 'Padaria Sol Comércio de Alimentos ME', cnpj: '12345678000195', tipo_pessoa: 'juridica', faturamento_ultimo_ano: 820000,
      funcionarios: 8, segmentos: ['comercio', 'industria'], cep: '36404450', uf: 'MG', telefone: '31987800133', email: 'contato@padariasol.com.br',
      honorario_mensal: 1250, dia_vencimento: 10, reajuste: 'anual', reajuste_mes: 3, decimo_terceiro: true, certificado_avisar_dias: 30,
      inscricoes_st: [{ uf: 'SP', inscricao: '123.456.789.110' }, { uf: 'RJ', inscricao: null }], servicos: [SERVICO],
      responsaveis: { [SETOR_FISCAL]: BIA }, complemento: null, contrato_fim: null,
    });
    expect(r.dados).not.toHaveProperty('agente_pausado');
  });

  it('pausa do agente só vai quando quem salva é o administrador (D14)', () => {
    const base = { razao_social: 'X Ltda', cnpj: '12345678000195' };
    const admin = lerFicha(form({ ...base, agente_pausado: 'on' }), { admin: true });
    expect(admin.ok && admin.dados.agente_pausado).toBe(true);
    const adminDesligou = lerFicha(form(base), { admin: true });
    expect(adminDesligou.ok && adminDesligou.dados.agente_pausado).toBe(false);
  });

  it('só razão social e CNPJ travam; o resto vazio vira nulo (pendência, não erro)', () => {
    const r = lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195' }), { admin: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados).toMatchObject({ regime: null, cep: null, segmentos: [], certificado_avisar_dias: 30, inscricoes_st: [], decimo_terceiro: null });
  });

  it('CNPJ inválido: erro no campo e o aviso de sempre ("Não foi possível salvar: … CNPJ inválido")', () => {
    const r = lerFicha(form({ razao_social: 'Cliente Com CNPJ Errado', cnpj: '11.222.333/0001-99' }), { admin: false });
    expect(r).toEqual({ ok: false, erros: { cnpj: 'CNPJ inválido', geral: 'Não foi possível salvar: CNPJ inválido. Confira o campo marcado.' } });
  });

  it('vários erros: o primeiro no aviso e a contagem', () => {
    const r = lerFicha(form({ razao_social: 'X', cnpj: '1', cep: '123', email_cobranca: 'sem-arroba', honorario_mensal: '12,345', dia_vencimento: '40' }), { admin: false });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros).toMatchObject({
      razao_social: 'Informe a razão social', cnpj: 'CNPJ inválido', cep: 'O CEP tem 8 números', email_cobranca: 'E-mail inválido',
      honorario_mensal: 'Valor inválido (ex.: 1.250,00)', dia_vencimento: 'Dia de 1 a 31',
    });
    expect(r.erros.geral).toBe('Não foi possível salvar: Informe a razão social. Confira os 6 campos marcados.');
  });

  it('inscrições ST: UF repetida ou sem UF recusam', () => {
    expect(lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195', st_uf: ['SP', 'sp'], st_inscricao: ['1', '2'] }), { admin: false }))
      .toMatchObject({ ok: false, erros: { inscricoes_st: 'UF repetida: SP' } });
    expect(lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195', st_uf: [''], st_inscricao: ['1'] }), { admin: false }))
      .toMatchObject({ ok: false, erros: { inscricoes_st: 'Escolha a UF de cada linha' } });
  });

  it('isento de IE não grava a inscrição; fim do contrato antes do início recusa', () => {
    const r = lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195', isento_ie: 'on', inscricao_estadual: '123' }), { admin: false });
    expect(r.ok && r.dados).toMatchObject({ isento_ie: true, inscricao_estadual: null });
    expect(lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195', contrato_inicio: '2022-03-01', contrato_fim: '2021-01-01' }), { admin: false }))
      .toMatchObject({ ok: false, erros: { contrato_fim: 'O fim vem depois do início' } });
  });

  it('responsável vazio vai como nulo (tira o responsável daquele setor)', () => {
    const r = lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195', [`responsavel:${SETOR_FISCAL}`]: '' }), { admin: false });
    expect(r.ok && r.dados.responsaveis).toEqual({ [SETOR_FISCAL]: null });
  });
});

describe('dinheiro e reajuste', () => {
  it('lê o jeito brasileiro', () => {
    expect(lerDinheiro('R$ 1.250,00')).toBe(1250);
    expect(lerDinheiro('1250,5')).toBe(1250.5);
    expect(lerDinheiro('1250')).toBe(1250);
    expect(lerDinheiro('')).toBeNull();
    expect(lerDinheiro('12,345')).toBe('invalido');
    expect(lerDinheiro('abc')).toBe('invalido');
  });
  it('mostra no campo sem o "R$" (ele fica ao lado)', () => {
    expect(dinheiroNoCampo(1250)).toBe('1.250,00');
    expect(dinheiroNoCampo(null)).toBe('');
  });
  it('reajuste do banco volta para o seletor', () => {
    expect(valorReajuste('anual', 3)).toBe('anual:3');
    expect(valorReajuste('sem', null)).toBe('sem');
    expect(valorReajuste(null, null)).toBe('');
  });
  it('regime antigo fora da lista continua como opção (D18)', () => {
    expect(opcoesRegime('Simples').at(-1)).toEqual({ valor: 'Simples', rotulo: 'Simples (antigo)' });
    expect(opcoesRegime('Lucro Real').some((o) => o.rotulo.includes('antigo'))).toBe(false);
  });
});

describe('índice: estado de cada bloco (D28)', () => {
  it('ficha vazia: pendências contadas, contato e fiscal neutros, acessos protegido', () => {
    const e = estadoDosBlocos(valoresDoCliente(null, [], 0), AGORA);
    expect(e.identificacao).toEqual({ tipo: 'pendente', n: 4 });
    expect(e.endereco).toEqual({ tipo: 'pendente', n: 6 });
    expect(e.contato).toEqual({ tipo: 'neutro' });
    expect(e.fiscal).toEqual({ tipo: 'neutro' });
    expect(e.contrato).toEqual({ tipo: 'pendente', n: 2 });
    expect(e.responsaveis).toEqual({ tipo: 'neutro' });
    expect(e.certificado).toEqual({ tipo: 'pendente', n: 1 });
    expect(e.acessos).toEqual({ tipo: 'protegido' });
  });

  it('lê do formulário: linha ST sem inscrição é pendência; certificado perto vence; "Sem certificado" completa', () => {
    const v = valoresDe(form({
      cnpj: '12.345.678/0001-95', razao_social: 'X', regime: 'MEI', segmentos: 'comercio', st_uf: ['SP', 'RJ'], st_inscricao: ['1', ''],
      certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-11-02', certificado_avisar_dias: '30', telefone: '3133334444',
      [`responsavel:${SETOR_FISCAL}`]: BIA,
    }));
    const e = estadoDosBlocos(v, AGORA);
    expect(e.identificacao).toEqual({ tipo: 'completo' });
    expect(e.fiscal).toEqual({ tipo: 'pendente', n: 1 });
    expect(e.contato).toEqual({ tipo: 'completo' });
    expect(e.responsaveis).toEqual({ tipo: 'completo' });
    expect(e.certificado).toEqual({ tipo: 'vence', dias: 23 });
    expect(estadoDosBlocos(valoresDe(form({ certificado_tipo: 'sem' })), AGORA).certificado).toEqual({ tipo: 'completo' });
    expect(estadoDosBlocos(valoresDe(form({ certificado_vencimento: '2030-10-01' })), AGORA).certificado).toEqual({ tipo: 'vencido', dias: 9 });
  });

  it('textos do índice (a cor nunca fala sozinha)', () => {
    expect(textoEstado({ tipo: 'pendente', n: 1 })).toBe('1 pendente');
    expect(textoEstado({ tipo: 'pendente', n: 2 })).toBe('2 pendentes');
    expect(textoEstado({ tipo: 'vence', dias: 23 })).toBe('vence');
    expect(textoEstado({ tipo: 'vencido', dias: 2 })).toBe('vencido');
    expect(textoEstado({ tipo: 'completo' })).toBe('completo');
    expect(textoEstado({ tipo: 'protegido' })).toBe('protegido');
    expect(textoEstado({ tipo: 'neutro' })).toBe('');
  });
});

describe('datas pelo dia de São Paulo', () => {
  it('23:30 em São Paulo ainda é o mesmo dia', () => {
    expect(diasAte('2030-10-11', new Date('2030-10-11T02:30:00Z'))).toBe(1);
    expect(diasAte('2030-10-11', new Date('2030-10-11T03:30:00Z'))).toBe(0);
  });
});

describe('cabeçalho e rodapé', () => {
  const c = { ativo: true, agente_pausado: false, regime: 'Simples Nacional', certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-11-02', certificado_avisar_dias: 30 };
  it('etiquetas: situação, certificado e regime (sempre com texto)', () => {
    expect(etiquetasDoTopo(c, AGORA)).toEqual([
      { texto: 'Ativo', variante: 'success', icone: 'ponto' },
      { texto: 'Certificado vence em 23 dias', variante: 'warning', icone: 'certificado' },
      { texto: 'Simples Nacional', variante: 'neutral' },
    ]);
    expect(etiquetasDoTopo({ ...c, ativo: false, agente_pausado: true, certificado_vencimento: '2030-10-09', regime: null }, AGORA)).toEqual([
      { texto: 'Arquivado', variante: 'neutral' },
      { texto: 'Agente pausado para esta empresa', variante: 'agent-paused' },
      { texto: 'Certificado vencido há 1 dia', variante: 'danger', icone: 'certificado' },
    ]);
    expect(etiquetasDoTopo({ ...c, certificado_tipo: 'sem' }, AGORA).some((e) => e.texto.startsWith('Certificado'))).toBe(false);
  });
  it('cliente desde: início do contrato ou data do cadastro', () => {
    expect(clienteDesde('2022-03-01', '2026-09-27T10:00:00Z')).toBe('03/2022');
    expect(clienteDesde(null, '2026-09-27T10:00:00Z')).toBe('09/2026');
  });
  it('última alteração em São Paulo', () => {
    expect(textoUltimaAlteracao({ pessoa: 'Ana', quando: '2026-09-28T19:20:00Z' })).toBe('Ana, 28/09 16:20');
    expect(textoUltimaAlteracao(null)).toBeNull();
  });
});

describe('busca e responsáveis', () => {
  it('mensagens da busca (nunca travam)', () => {
    expect(mensagemBusca('cnpj', 'nao_encontrado')).toBe('Não achei este CNPJ na busca pública. Preencha à mão.');
    expect(mensagemBusca('cep', 'nao_encontrado')).toBe('Não achei este CEP. Preencha à mão.');
    expect(mensagemBusca('cep', 'indisponivel')).toBe('Não consegui buscar agora. Preencha à mão.');
    expect(textoPreenchido(['razao_social', 'nome_fantasia', 'cnae_principal', 'cep', 'logradouro'])).toBe(
      'Preenchido pela busca: razão social, nome fantasia, CNAE e endereço.');
    expect(textoPreenchido([])).toBe('A busca não trouxe nada novo: os campos já estavam preenchidos.');
  });
  it('setores dos serviços marcados (e os que já têm responsável) primeiro; o resto em "Outros setores" (D16)', () => {
    const setores = [{ id: 'f', nome: 'Fiscal' }, { id: 'p', nome: 'Pessoal' }, { id: 'n', nome: 'Financeiro' }, { id: 'l', nome: 'Legalização' }];
    const servicos = [{ id: 's1', nome: 'Fiscal', setor_id: 'f' }, { id: 's2', nome: 'Folha', setor_id: 'p' }];
    expect(separarSetores(setores, servicos, ['s1'], { n: BIA })).toEqual({ principais: [setores[0], setores[2]], outros: [setores[1], setores[3]] });
    expect(separarSetores(setores, servicos, [], {})).toEqual({ principais: setores, outros: [] });
  });
});

describe('conferências antes de salvar (itens adiados para a Task 8)', () => {
  const base = { razao_social: 'X Ltda', cnpj: '12345678000195' };

  it('linha de substituto tributário toda em branco é ignorada (não bloqueia nem vira pendência)', () => {
    const r = lerFicha(form({ ...base, st_uf: ['SP', '', ' '], st_inscricao: ['1', '', ''] }), { admin: false });
    expect(r.ok && r.dados.inscricoes_st).toEqual([{ uf: 'SP', inscricao: '1' }]);
    expect(estadoDosBlocos(valoresDe(form({ st_uf: [''], st_inscricao: [''] })), AGORA).fiscal).toEqual({ tipo: 'neutro' });
    expect(lerFicha(form({ ...base, st_uf: ['SP'], st_inscricao: ['1'.repeat(31)] }), { admin: false }))
      .toMatchObject({ ok: false, erros: { inscricoes_st: 'Inscrição com até 30 letras' } });
  });

  it('data de verdade: 2030-13-45 e 2030-02-30 recusam; 2028-02-29 passa', () => {
    const r = lerFicha(form({ ...base, contrato_inicio: '2030-13-45', certificado_vencimento: '2030-02-30' }), { admin: false });
    expect(r).toMatchObject({ ok: false, erros: { contrato_inicio: 'Data inválida', certificado_vencimento: 'Data inválida' } });
    const ok = lerFicha(form({ ...base, contrato_inicio: '2028-02-29' }), { admin: false });
    expect(ok.ok && ok.dados.contrato_inicio).toBe('2028-02-29');
  });

  it('vencimento inválido no índice é pendência, nunca "completo"', () => {
    expect(Number.isNaN(diasAte('2030-13-45', AGORA))).toBe(true);
    expect(estadoDosBlocos(valoresDe(form({ certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-13-45' })), AGORA).certificado)
      .toEqual({ tipo: 'pendente', n: 1 });
    expect(estadoDosBlocos(valoresDe(form({ certificado_vencimento: 'lixo' })), AGORA).certificado).toEqual({ tipo: 'pendente', n: 1 });
  });

  it('honorário e faturamento cabem na coluna do banco', () => {
    expect(lerFicha(form({ ...base, honorario_mensal: '10.000.000.000,00' }), { admin: false }))
      .toMatchObject({ ok: false, erros: { honorario_mensal: 'Valor acima do limite' } });
    const ok = lerFicha(form({ ...base, honorario_mensal: '9.999.999.999,99', faturamento_ultimo_ano: '999.999.999.999,99' }), { admin: false });
    expect(ok.ok && ok.dados).toMatchObject({ honorario_mensal: 9999999999.99, faturamento_ultimo_ano: 999999999999.99 });
    expect(lerFicha(form({ ...base, faturamento_ultimo_ano: '1000000000000' }), { admin: false }))
      .toMatchObject({ ok: false, erros: { faturamento_ultimo_ano: 'Valor acima do limite' } });
  });

  it('textos longos demais recusam no campo', () => {
    const r = lerFicha(form({ ...base, nome_fantasia: 'N'.repeat(151), numero: '1'.repeat(21), cidade: 'C'.repeat(101) }), { admin: false });
    expect(r).toMatchObject({ ok: false, erros: { nome_fantasia: 'Até 150 letras', numero: 'Até 20 letras', cidade: 'Até 100 letras' } });
    expect(lerFicha(form({ ...base, razao_social: 'R'.repeat(151) }), { admin: false }))
      .toMatchObject({ ok: false, erros: { razao_social: 'Até 150 letras' } });
  });

  it('arquivo no lugar de texto não vira "[object File]"', () => {
    const f = form(base);
    f.append('nome_fantasia', new File(['x'], 'x.txt'));
    f.append('st_uf', new File(['x'], 'x.txt'));
    f.append('st_inscricao', '');
    const r = lerFicha(f, { admin: false });
    expect(r.ok && r.dados).toMatchObject({ nome_fantasia: null, inscricoes_st: [] });
  });
});
