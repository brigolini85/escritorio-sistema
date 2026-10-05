import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { lerAcesso, primeiroNome, semMigracaoH2 } = await import('./acesso-contato');

// Parte H2 (D24): sem a migração, as leituras dizem "sem-migracao" pelo código do erro (nunca contagem head).
describe('semMigracaoH2', () => {
  it('coluna, relação e função que não existem', () => {
    for (const code of ['42703', '42P01', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205']) expect(semMigracaoH2({ code })).toBe(true);
    expect(semMigracaoH2({ code: '42501' })).toBe(false);
    expect(semMigracaoH2(null)).toBe(false);
  });
});

describe('lerAcesso', () => {
  it('linha do banco → perfil e marcações', () => {
    expect(lerAcesso({
      perfil: 'compras_vendas', pode_pedir_nota: true, pode_atualizar_preco: true, ver_valores: false, receber_documentos: true,
      avisar_documento_novo: ['whatsapp', 'sms'], recebe_alertas_acesso: false,
      contato_cliente_setores: [{ setor_id: 'fis', pode_ser_procurado: true }],
    })).toEqual({
      perfil: 'compras_vendas',
      marcas: { setores: [{ setorId: 'fis', podeSerProcurado: true }], podePedirNota: true, podeAtualizarPreco: true, verValores: false,
        receberDocumentos: true, avisarDocumentoNovo: ['whatsapp'], recebeAlertasAcesso: false },
    });
  });
  it('perfil estranho vira Básico; faltando tudo, nada marcado', () => {
    expect(lerAcesso({ perfil: 'chefe' })).toEqual({ perfil: 'basico', marcas: {
      setores: [], podePedirNota: false, podeAtualizarPreco: false, verValores: false, receberDocumentos: false, avisarDocumentoNovo: [], recebeAlertasAcesso: false } });
  });
  it('primeiro nome para a prévia', () => {
    expect(primeiroNome('  Roberto Faria ')).toBe('Roberto');
  });
});

// Banco falso: cada tabela devolve o resultado configurado, qualquer que seja o filtro.
const sbFalso = (tabelas: Record<string, { data: unknown; error: unknown }>) => ({
  from: (t: string) => {
    const r = tabelas[t] ?? { data: [], error: null };
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'neq', 'order']) q[m] = () => q;
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(r).then(ok);
    return q;
  },
});

describe('lerContatosDaEmpresa', () => {
  const setores = [
    { id: 'fis', nome: 'Fiscal', descricao_assuntos: 'Notas' },
    { id: 'pes', nome: 'Pessoal', descricao_assuntos: 'Folha' },
    { id: 'fin', nome: 'Financeiro', descricao_assuntos: 'Boletos' },
  ];
  const vinculo = (id: string, nome: string, setoresMarcados: string[]) => ({
    perfil: 'personalizado', contato_cliente_setores: setoresMarcados.map((s) => ({ setor_id: s, pode_ser_procurado: false })),
    contatos: { id, nome, telefone: '5531999990000', cargo: null, email: null, agente_pausado: false, ativo: true },
  });

  it('banco sem a migração (código do erro): "sem-migracao"', async () => {
    const { lerContatosDaEmpresa } = await import('./acesso-contato');
    const sb = sbFalso({ contato_clientes: { data: null, error: { code: '42703' } } });
    expect(await lerContatosDaEmpresa(sb as never, 'cli')).toBe('sem-migracao');
  });

  it('"fora do contrato" é de cada contato: o setor marcado por um não aparece no bloco do outro', async () => {
    const { lerContatosDaEmpresa } = await import('./acesso-contato');
    const sb = sbFalso({
      contato_clientes: { data: [vinculo('a', 'Ana', ['pes']), vinculo('b', 'Bia', [])], error: null },
      setores: { data: setores, error: null },
      cliente_servicos: { data: [{ cliente_id: 'cli', servicos: { setor_id: 'fis', ativo: true } }], error: null },
    });
    const ficha = await lerContatosDaEmpresa(sb as never, 'cli');
    if (!ficha || ficha === 'sem-migracao') throw new Error('esperava a ficha');
    const ids = (nome: string) => ficha.contatos.find((c) => c.nome === nome)!.disponiveis.map((s) => `${s.id}${s.contratado ? '' : '*'}`);
    expect(ids('Ana')).toEqual(['fis', 'pes*', 'fin']);
    expect(ids('Bia')).toEqual(['fis', 'fin']);
    expect(ficha.disponiveis.map((s) => s.id)).toEqual(['fis', 'fin']);
  });
});
