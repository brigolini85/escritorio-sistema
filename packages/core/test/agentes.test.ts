import { describe, expect, it } from 'vitest';
import {
  CATALOGO_FERRAMENTAS, FERRAMENTAS_ATENDIMENTO, INFO_TIPO_SKILL, TIPOS_SKILL, diferencaLinhas, exigeAprovacao, lerSkillMd,
  montarPacoteSkill, slugDoNome, tipoDoTexto,
} from '../src';

const md = (cabecalho: string, corpo = '# Título da skill\nTexto.') => `---\n${cabecalho}\n---\n${corpo}`;

describe('catálogo de ferramentas (D15)', () => {
  it('as 16 do Thiago, na ordem de FERRAMENTAS do trabalhador', () => {
    expect(FERRAMENTAS_ATENDIMENTO).toEqual([
      'selecionar_empresa', 'abrir_chamado', 'consultar_chamados', 'sinalizar_nao_entendido', 'passar_para_pessoa', 'buscar_parceiros',
      'buscar_produtos', 'resumir_pedido_nota', 'abrir_pedido_nota', 'listar_documentos', 'enviar_documento', 'consultar_cadastro',
      'consultar_preco', 'alterar_preco', 'cadastrar_produto', 'responder',
    ]);
  });
  it('só leitura × grava/envia (aprovação)', () => {
    expect(exigeAprovacao(CATALOGO_FERRAMENTAS.consultar_chamados)).toBe(false);
    expect(exigeAprovacao(CATALOGO_FERRAMENTAS.responder)).toBe(true);
    expect(CATALOGO_FERRAMENTAS.enviar_documento.efeito).toBe('envia');
    expect(CATALOGO_FERRAMENTAS.alterar_preco.efeito).toBe('grava');
  });
});

describe('tipos de skill (spec 7E.3)', () => {
  it('ordem da tela e só Jeito e Limites sempre lidos', () => {
    expect([...TIPOS_SKILL].sort((a, b) => INFO_TIPO_SKILL[a].ordem - INFO_TIPO_SKILL[b].ordem))
      .toEqual(['jeito', 'limites', 'procedimento', 'conhecimento', 'exemplos']);
    expect(TIPOS_SKILL.filter((t) => INFO_TIPO_SKILL[t].sempre)).toEqual(['jeito', 'limites']);
  });
  it('tipo escrito de vários jeitos (D8)', () => {
    expect(tipoDoTexto('Jeito de atuar')).toBe('jeito');
    expect(tipoDoTexto('LIMITES')).toBe('limites');
    expect(tipoDoTexto('Procedimentos')).toBe('procedimento');
    expect(tipoDoTexto('exemplo')).toBe('exemplos');
    expect(tipoDoTexto('Conhecimentos')).toBe('conhecimento');
    expect(tipoDoTexto('qualquer')).toBeNull();
  });
});

describe('lerSkillMd', () => {
  it('lê name, description (com aspas e continuação), tipo e o título do texto', () => {
    const r = lerSkillMd(md('name: tabela-cfop\ndescription: "CFOPs de venda,\n  devolução e remessa."\ntipo: conhecimento'));
    expect(r).toEqual({ ok: true, skill: { nome: 'tabela-cfop', descricao: 'CFOPs de venda, devolução e remessa.', tipo: 'conhecimento',
      titulo: 'Título da skill', corpo: '# Título da skill\nTexto.' } });
  });
  it('sem tipo: tipo null; sem # título: o name', () => {
    const r = lerSkillMd(md('name: jeito-do-fiscal\ndescription: Tom.', 'Fala curta.'));
    expect(r).toMatchObject({ ok: true, skill: { tipo: null, titulo: 'jeito-do-fiscal' } });
  });
  it('arquivo do Windows (CRLF e BOM)', () => {
    expect(lerSkillMd(`\uFEFF---\r\nname: a\r\ndescription: b\r\n---\r\nTexto.`)).toMatchObject({ ok: true, skill: { nome: 'a', corpo: 'Texto.' } });
  });
  it('recusas com a frase para a pessoa', () => {
    expect(lerSkillMd('# Sem cabeçalho')).toEqual({ ok: false, erro: 'O SKILL.md precisa começar com o cabeçalho entre linhas "---" (name, description e tipo).' });
    expect(lerSkillMd(md('description: x'))).toEqual({ ok: false, erro: 'Falta "name" no cabeçalho do SKILL.md.' });
    expect(lerSkillMd(md('name: Tabela CFOP\ndescription: x'))).toEqual({ ok: false,
      erro: 'O "name" usa só letras minúsculas, números e hífen (até 64), como nas skills do Claude.' });
    expect(lerSkillMd(md('name: a'))).toEqual({ ok: false, erro: 'Falta "description" no cabeçalho do SKILL.md.' });
    expect(lerSkillMd(md('name: a\ndescription: b\ntipo: regra'))).toEqual({ ok: false,
      erro: 'Tipo desconhecido no cabeçalho: "regra". Use jeito, limites, procedimento, conhecimento ou exemplos.' });
    expect(lerSkillMd(md('name: a\ndescription: b', 'x'.repeat(20_001)))).toEqual({ ok: false, erro: 'O texto do SKILL.md passa de 20.000 caracteres.' });
  });
});

describe('montarPacoteSkill (pasta, .zip e .md)', () => {
  const skill = md('name: tabela-cfop\ndescription: CFOPs.\ntipo: conhecimento');
  it('pasta (ou .zip) com uma pasta em volta, lixo do macOS e arquivo oculto', () => {
    const r = montarPacoteSkill([
      { caminho: 'tabela-cfop/SKILL.md', conteudo: skill }, { caminho: 'tabela-cfop/refs/cfop.csv', conteudo: '5102;Venda' },
      { caminho: '__MACOSX/tabela-cfop/._SKILL.md', conteudo: 'x' }, { caminho: 'tabela-cfop/.DS_Store', conteudo: 'x' },
    ], null);
    expect(r).toEqual({ ok: true, pacote: { nome: 'tabela-cfop', titulo: 'Título da skill', descricao: 'CFOPs.', tipo: 'conhecimento',
      corpo: '# Título da skill\nTexto.', skill_md: skill, arquivos: [{ caminho: 'refs/cfop.csv', conteudo: '5102;Venda' }] } });
  });
  it('um .md solto é o SKILL.md; sem tipo, vale o escolhido; sem nenhum, pergunta', () => {
    const solto = md('name: limite-x\ndescription: Limite.');
    expect(montarPacoteSkill([{ caminho: 'limite.md', conteudo: solto }], 'limites')).toMatchObject({ ok: true, pacote: { tipo: 'limites', arquivos: [] } });
    expect(montarPacoteSkill([{ caminho: 'limite.md', conteudo: solto }], null)).toEqual({ ok: false, precisaTipo: true, nome: 'limite-x', titulo: 'Título da skill' });
  });
  it('o tipo do cabeçalho vence o escolhido na tela', () => {
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }], 'limites')).toMatchObject({ ok: true, pacote: { tipo: 'conhecimento' } });
  });
  it('recusas: sem SKILL.md, PDF, outro formato, binário, caminho com .., arquivos demais', () => {
    expect(montarPacoteSkill([{ caminho: 'a.txt', conteudo: 'x' }, { caminho: 'b.txt', conteudo: 'y' }], null))
      .toEqual({ ok: false, erro: 'Não achei o SKILL.md (na raiz da pasta ou do .zip).' });
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }, { caminho: 'guia.pdf', conteudo: '%PDF' }], null))
      .toEqual({ ok: false, erro: 'PDF ainda não entra nas skills: mande o texto em .md, .txt ou .csv (PDF chega com as tarefas de trabalho).' });
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }, { caminho: 'planilha.xlsx', conteudo: 'x' }], null))
      .toEqual({ ok: false, erro: 'O arquivo "planilha.xlsx" não é .md, .txt nem .csv.' });
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }, { caminho: 'a.txt', conteudo: 'a\u0000b' }], null))
      .toEqual({ ok: false, erro: 'O arquivo "a.txt" não é texto.' });
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }, { caminho: 'x/../y.md', conteudo: 'a' }], null))
      .toEqual({ ok: false, erro: 'Nome de arquivo inválido: "x/../y.md".' });
    const muitos = Array.from({ length: 21 }, (_, i) => ({ caminho: `r${i}.md`, conteudo: 'x' }));
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }, ...muitos], null))
      .toEqual({ ok: false, erro: 'No máximo 20 arquivos de referência por skill.' });
    expect(montarPacoteSkill([], null)).toEqual({ ok: false, erro: 'Nenhum arquivo para subir.' });
  });
});

describe('diferencaLinhas (D9)', () => {
  it('linhas iguais, tiradas e postas', () => {
    expect(diferencaLinhas('a\nb\nc', 'a\nB\nc\nd')).toEqual([
      { tipo: 'igual', texto: 'a' }, { tipo: 'menos', texto: 'b' }, { tipo: 'mais', texto: 'B' }, { tipo: 'igual', texto: 'c' },
      { tipo: 'mais', texto: 'd' },
    ]);
  });
});

describe('slugDoNome (D25)', () => {
  it('sem acento, minúsculo, com hífen, até 40, começando por letra', () => {
    expect(slugDoNome('Agente de Legalização')).toBe('agente-de-legalizacao');
    expect(slugDoNome('  IRPF 2027!! ')).toBe('irpf-2027');
    expect(slugDoNome('123')).toBe('agente-123');
    expect(slugDoNome('!!!')).toBe('agente');
    expect(slugDoNome('x'.repeat(60))).toHaveLength(40);
  });
});
