import { describe, expect, it } from 'vitest';
import {
  etiquetasPodeTratar, marcasBasicas, marcasDoPerfil, perfilDasMarcas, previaDoAgente, setoresDisponiveis, type MarcasAcesso, type SetorDisponivel,
} from '../src/acesso';

// Parte H2 (spec 7D.2, D3–D5, D26, D27): o perfil é atalho; o que vale são as marcações.
const TODOS = [
  { id: 'pes', nome: 'Pessoal', descricao_assuntos: 'Folha de pagamento, holerites, admissão' },
  { id: 'con', nome: 'Contábil', descricao_assuntos: 'Balancete, balanço' },
  { id: 'fis', nome: 'Fiscal', descricao_assuntos: 'Notas fiscais, guias' },
  { id: 'fin', nome: 'Financeiro', descricao_assuntos: 'Honorários do escritório, boletos' },
  { id: 'leg', nome: 'Legalização', descricao_assuntos: 'Abertura, alteração' },
  { id: 'dir', nome: 'Direção', descricao_assuntos: 'Assuntos sensíveis' },
  { id: 'aud', nome: 'Auditoria', descricao_assuntos: 'Revisão de livros, conferência, inventário, outros' },
];
// A Rede Bom Preço da imagem: contrata Fiscal, Pessoal, Contábil e Legalização (Financeiro entra sempre).
const REDE = setoresDisponiveis(TODOS, ['fis', 'pes', 'con', 'leg'], []).setores;

describe('setoresDisponiveis', () => {
  it('contratados + Financeiro, na ordem da imagem, sem Direção, com a dica curta', () => {
    expect(REDE.map((s) => [s.nome, s.contratado, s.dica])).toEqual([
      ['Fiscal', true, 'notas, impostos'], ['Pessoal', true, 'folha, férias, admissão'], ['Contábil', true, 'balanço, balancete'],
      ['Financeiro', true, 'honorários, boletos'], ['Legalização', true, 'contrato, alvarás'],
    ]);
  });
  it('setor marcado que saiu do contrato aparece como fora do contrato (nada some escondido)', () => {
    const r = setoresDisponiveis(TODOS, ['fis'], ['aud']);
    expect(r.setores.map((s) => [s.nome, s.contratado])).toEqual([['Fiscal', true], ['Financeiro', true], ['Auditoria', false]]);
    expect(r.setores.at(-1)!.dica).toBe('revisão de livros, conferência, inventário');
  });
  it('empresa sem serviço ligado a setor: todos os setores (menos Direção)', () => {
    const r = setoresDisponiveis(TODOS, [], []);
    expect(r.semServicoComSetor).toBe(true);
    expect(r.setores.map((s) => s.nome)).toEqual(['Fiscal', 'Pessoal', 'Contábil', 'Financeiro', 'Legalização', 'Auditoria']);
  });
});

const so = (m: MarcasAcesso) => m.setores.map((s) => `${s.setorId}${s.podeSerProcurado ? '*' : ''}`).sort();

describe('marcasDoPerfil e perfilDasMarcas', () => {
  it('Compras/Vendas é a Carla da imagem', () => {
    const m = marcasDoPerfil('compras_vendas', REDE);
    expect(so(m)).toEqual(['fis*']);
    expect(m).toMatchObject({ podePedirNota: true, podeAtualizarPreco: true, verValores: false, receberDocumentos: true, avisarDocumentoNovo: ['whatsapp'], recebeAlertasAcesso: false });
  });
  it('Sócio marca todos os contratados, valores e alertas', () => {
    const m = marcasDoPerfil('socio', REDE);
    expect(so(m)).toEqual(['con*', 'fin*', 'fis*', 'leg*', 'pes*']);
    expect(m).toMatchObject({ podePedirNota: true, podeAtualizarPreco: true, verValores: true, receberDocumentos: true, recebeAlertasAcesso: true });
  });
  it('RH/DP, Financeiro, Administrativo e Funcionário (D4)', () => {
    expect(so(marcasDoPerfil('rh_dp', REDE))).toEqual(['pes*']);
    expect(marcasDoPerfil('rh_dp', REDE).verValores).toBe(true);
    expect(so(marcasDoPerfil('financeiro', REDE))).toEqual(['con*', 'fin*']);
    expect(so(marcasDoPerfil('administrativo', REDE))).toEqual(['con*', 'fin*', 'fis*', 'leg*']);
    expect(marcasDoPerfil('funcionario', REDE)).toMatchObject({ podePedirNota: true, receberDocumentos: false, verValores: false });
    expect(so(marcasDoPerfil('funcionario', REDE))).toEqual(['fis']);
  });
  it('cada perfil pronto volta como ele mesmo', () => {
    for (const p of ['socio', 'administrativo', 'financeiro', 'rh_dp', 'compras_vendas', 'funcionario', 'basico'] as const) {
      expect(perfilDasMarcas(marcasDoPerfil(p, REDE), REDE)).toBe(p);
    }
  });
  it('mudar uma marcação vira Personalizado; desfazer volta ao perfil', () => {
    const m = marcasDoPerfil('compras_vendas', REDE);
    const comPessoal = { ...m, setores: [...m.setores, { setorId: 'pes', podeSerProcurado: false }] };
    expect(perfilDasMarcas(comPessoal, REDE)).toBe('personalizado');
    expect(perfilDasMarcas({ ...comPessoal, setores: m.setores }, REDE)).toBe('compras_vendas');
  });
  it('avisos não mudam o perfil (D3)', () => {
    const m = marcasDoPerfil('socio', REDE);
    expect(perfilDasMarcas({ ...m, avisarDocumentoNovo: [], recebeAlertasAcesso: false }, REDE)).toBe('socio');
  });
  it('contato antigo com "pode pedir nota" e nenhum setor continua Básico (D2, D3)', () => {
    expect(perfilDasMarcas({ ...marcasBasicas(), podePedirNota: true, podeAtualizarPreco: true }, REDE)).toBe('basico');
  });
});

const socio = (): MarcasAcesso => marcasDoPerfil('socio', REDE);
const carla = (): MarcasAcesso => marcasDoPerfil('compras_vendas', REDE);

describe('previaDoAgente (spec 7D.2, D26)', () => {
  it('Carla: o texto da imagem', () => {
    expect(previaDoAgente({ marcas: carla(), disponiveis: REDE, socios: ['Roberto'] })).toEqual({
      pode: 'Abre e consulta demandas do Fiscal, pede nota, ajusta preços e produtos, envia documentos do Fiscal.',
      recusa: 'Se pedir algo de Pessoal, Contábil, Financeiro ou Legalização, ou perguntar valores: responde que vai tratar com o responsável da empresa, não revela nada, deixa uma nota para o setor e avisa o sócio (Roberto).',
      procurado: 'Pode receber lembretes e cobranças do Fiscal.',
    });
  });
  it('a prévia muda com as marcações (Pessoal e Ver valores)', () => {
    const m = { ...carla(), verValores: true, setores: [...carla().setores, { setorId: 'pes', podeSerProcurado: false }] };
    const p = previaDoAgente({ marcas: m, disponiveis: REDE, socios: ['Roberto', 'Ana'] });
    expect(p.pode).toBe('Abre e consulta demandas do Fiscal e do Pessoal, pede nota, ajusta preços e produtos, envia documentos do Fiscal e do Pessoal, vê valores.');
    expect(p.recusa).toBe('Se pedir algo de Contábil, Financeiro ou Legalização: responde que vai tratar com o responsável da empresa, não revela nada, deixa uma nota para o setor e avisa os sócios (Roberto e Ana).');
  });
  it('sem ninguém para avisar, diz que só o setor fica sabendo', () => {
    expect(previaDoAgente({ marcas: carla(), disponiveis: REDE, socios: [] }).recusa)
      .toMatch(/deixa uma nota para o setor \(a empresa não tem ninguém marcado para receber alertas de acesso\)\.$/);
  });
  it('Sócio: todos os setores, nada a recusar', () => {
    expect(previaDoAgente({ marcas: socio(), disponiveis: REDE, socios: [] })).toEqual({
      pode: 'Abre e consulta demandas de todos os setores contratados, pede nota, ajusta preços e produtos, envia documentos de todos os setores contratados, vê valores.',
      recusa: null,
      procurado: 'Pode receber lembretes e cobranças do Fiscal, do Pessoal, do Contábil, do Financeiro e da Legalização.',
    });
  });
  it('Básico', () => {
    expect(previaDoAgente({ marcas: marcasBasicas(), disponiveis: REDE, socios: ['Roberto'] })).toEqual({
      pode: 'Conversa e abre demandas para a equipe.',
      recusa: 'Não consulta demandas, dados nem documentos: até alguém liberar o acesso, tudo vira demanda para a equipe conferir.',
      procurado: null,
    });
  });
  // Onda final (Minor 1): nota, preço e produtos seguem a regra das ferramentas (podeFluxoNota: "pode pedir nota" OU Fiscal marcado).
  it('"Pode mudar preço" sem nota e sem Fiscal não promete ajustar preços', () => {
    const m = { ...marcasDoPerfil('financeiro', REDE), podeAtualizarPreco: true };
    const p = previaDoAgente({ marcas: m, disponiveis: REDE, socios: [] });
    expect(p.pode).not.toMatch(/pede nota|ajusta preços/);
    expect(p.pode).toBe('Abre e consulta demandas do Contábil e do Financeiro, envia documentos do Contábil e do Financeiro, vê valores.');
  });
  it('Fiscal marcado sem "Pode pedir nota" já pede nota (e ajusta preços com "Pode mudar preço")', () => {
    const soFiscal = { ...marcasBasicas(), setores: [{ setorId: 'fis', podeSerProcurado: false }] };
    expect(previaDoAgente({ marcas: soFiscal, disponiveis: REDE, socios: [] }).pode).toBe('Abre e consulta demandas do Fiscal, pede nota.');
    expect(previaDoAgente({ marcas: { ...soFiscal, podeAtualizarPreco: true }, disponiveis: REDE, socios: [] }).pode)
      .toBe('Abre e consulta demandas do Fiscal, pede nota, ajusta preços e produtos.');
  });
  it('Básico: preço só com "Pode pedir nota" junto', () => {
    const b = marcasBasicas();
    expect(previaDoAgente({ marcas: { ...b, podeAtualizarPreco: true }, disponiveis: REDE, socios: [] }).pode).toBe('Conversa e abre demandas para a equipe.');
    expect(previaDoAgente({ marcas: { ...b, podePedirNota: true, podeAtualizarPreco: true }, disponiveis: REDE, socios: [] }).pode)
      .toBe('Conversa e abre demandas para a equipe, pede nota, ajusta preços e produtos.');
  });
});

describe('etiquetasPodeTratar (D27)', () => {
  const textos = (perfil: Parameters<typeof etiquetasPodeTratar>[0], m: MarcasAcesso, d: SetorDisponivel[] = REDE) =>
    etiquetasPodeTratar(perfil, m, d).map((e) => `${e.tipo}:${e.texto}`);
  it('como na imagem', () => {
    expect(textos('socio', socio())).toEqual(['todos:Todos os setores contratados']);
    expect(textos('compras_vendas', carla())).toEqual(['setor:Fiscal', 'extra:pede nota', 'extra:muda preço']);
    expect(textos('rh_dp', marcasDoPerfil('rh_dp', REDE))).toEqual(['setor:Pessoal', 'extra:vê valores']);
    expect(textos('basico', marcasBasicas())).toEqual(['basico:Só conversa e abre demanda']);
  });
  it('Básico antigo com nota mostra a nota', () => {
    expect(textos('basico', { ...marcasBasicas(), podePedirNota: true })).toEqual(['basico:Só conversa e abre demanda', 'extra:pede nota']);
  });
});
