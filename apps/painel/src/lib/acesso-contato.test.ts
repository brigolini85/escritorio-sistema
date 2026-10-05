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
