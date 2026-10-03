import { describe, expect, it } from 'vitest';
import { errosDoBanco, lerFicha, paraBanco } from './esquemas';

const SETOR = '11111111-1111-4111-8111-111111111111';
function form(campos: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
const BASE = { nome: 'Ana Paula Souza', email: 'Ana@Escritorio.com.br ', cargo: 'Analista', papel: 'atendente', telefone: '(11) 98888-1234',
  setor: [SETOR], observacoes: 'Férias de 10 a 24/11', horario_restrito: 'sim', horario_semana: 'permitido', horario_semana_de: '08:00',
  horario_semana_ate: '18:00', horario_sabado: 'bloqueado', horario_domingo: 'bloqueado' };

describe('lerFicha (Parte D)', () => {
  it('lê a ficha inteira, com níveis e horário', () => {
    const r = lerFicha(form({ ...BASE, nivel_demandas: 'meu_setor', nivel_clientes: 'editar', nivel_assistente: 'site_whatsapp' }));
    expect(r).toEqual({ ok: true, dados: {
      nome: 'Ana Paula Souza', email: 'ana@escritorio.com.br', cargo: 'Analista', papel: 'atendente', telefone: '5511988881234',
      setores: [SETOR], observacoes: 'Férias de 10 a 24/11', niveis: { demandas: 'meu_setor', clientes: 'editar', assistente: 'site_whatsapp' },
      horario: { semana: { de: '08:00', ate: '18:00' }, sabado: null, domingo: null },
    } });
  });

  it('administrador: níveis escondidos e horário ficam de fora (não são apagados)', () => {
    const r = lerFicha(form({ nome: 'Dono', email: 'dono@escritorio.com.br', papel: 'admin', nivel_assistente: 'site' }));
    expect(r.ok && r.dados.niveis).toEqual({ assistente: 'site' });
    expect(r.ok && r.dados.horario).toBeUndefined();
    expect(r.ok && paraBanco(r.dados)).not.toHaveProperty('horario_acesso');
  });

  it('sem restrição de horário vai como null', () => {
    const r = lerFicha(form({ ...BASE, horario_restrito: 'nao' }));
    expect(r.ok && paraBanco(r.dados).horario_acesso).toBeNull();
  });

  it('erros por campo, todos de uma vez, sem perder nada', () => {
    expect(lerFicha(form({ ...BASE, nome: 'A', telefone: '123', horario_semana_de: '18:00', horario_semana_ate: '08:00' }))).toEqual({
      ok: false, erros: { nome: 'Informe o nome', telefone: 'Telefone inválido', horario: 'Seg a sex: o fim precisa ser depois do início.' },
    });
    expect(lerFicha(form({ ...BASE, telefone: '', nivel_assistente: 'site_whatsapp' })))
      .toEqual({ ok: false, erros: { telefone: 'Informe o telefone para usar o assistente pelo WhatsApp' } });
    expect(lerFicha(form({ ...BASE, nivel_demandas: 'tudo' }))).toEqual({ ok: false, erros: { niveis: 'Nível desconhecido.' } });
  });

  it('mensagem do banco vai para o campo certo', () => {
    expect(errosDoBanco('Você não pode tirar o seu próprio acesso de administrador.')).toEqual({ papel: 'Você não pode tirar o seu próprio acesso de administrador.' });
    expect(errosDoBanco('Informe o telefone para usar o assistente pelo WhatsApp.')).toEqual({ telefone: 'Informe o telefone para usar o assistente pelo WhatsApp' });
    expect(errosDoBanco('A user with this email address has already been registered')).toEqual({ email: 'Já existe uma pessoa com este e-mail.' });
    expect(errosDoBanco('Horário de acesso inválido.')).toEqual({ horario: 'Horário de acesso inválido.' });
  });

  // Sobras da Task 5: nenhum erro cru de salvar_usuario chega à tela.
  it('e-mail repetido (23505) vai para o campo e-mail', () => {
    expect(errosDoBanco('duplicate key value violates unique constraint "usuarios_email_key"')).toEqual({ email: 'Já existe uma pessoa com este e-mail.' });
  });
  it('nível, nome e setor recusados pelo banco vão para o campo', () => {
    expect(errosDoBanco('Nível inválido em demandas.')).toEqual({ niveis: 'Nível desconhecido.' });
    expect(errosDoBanco('Informe o nome.')).toEqual({ nome: 'Informe o nome' });
  });
  it('erro técnico (formato, pessoa sem login) vira aviso geral legível', () => {
    expect(errosDoBanco('invalid input syntax for type uuid: "x"')).toEqual({ geral: 'Não consegui salvar: a ficha veio num formato inesperado. Recarregue a página e tente de novo.' });
    expect(errosDoBanco('cannot call jsonb_each_text on a non-object')).toEqual({ geral: 'Não consegui salvar: a ficha veio num formato inesperado. Recarregue a página e tente de novo.' });
    expect(errosDoBanco('insert or update on table "usuarios" violates foreign key constraint "usuarios_id_fkey"'))
      .toEqual({ geral: 'Não encontrei o acesso desta pessoa. Volte à lista e abra a ficha de novo.' });
  });
  // Revisão das Tasks 10–12: só as recusas conhecidas do banco aparecem como vieram; o resto vira texto fixo.
  it('recusas conhecidas do banco passam; texto desconhecido vira a falha genérica', () => {
    expect(errosDoBanco('Setor não encontrado.')).toEqual({ geral: 'Setor não encontrado.' });
    expect(errosDoBanco('Esta pessoa está arquivada. Restaure antes de mudar.')).toEqual({ geral: 'Esta pessoa está arquivada. Restaure antes de mudar.' });
    expect(errosDoBanco('permission denied for table usuarios')).toEqual({ geral: 'Não consegui salvar agora. Tente de novo.' });
    expect(errosDoBanco('Database error saving new user')).toEqual({ geral: 'Não consegui salvar agora. Tente de novo.' });
  });
  it('erro do convite: e-mail repetido no campo; o resto, texto fixo do convite', () => {
    expect(errosDoBanco('A user with this email address has already been registered', 'convite')).toEqual({ email: 'Já existe uma pessoa com este e-mail.' });
    expect(errosDoBanco('Email rate limit exceeded', 'convite')).toEqual({ geral: 'Não consegui enviar o convite agora. Tente de novo em alguns minutos.' });
    expect(errosDoBanco('Error sending invite email', 'convite')).toEqual({ geral: 'Não consegui enviar o convite agora. Tente de novo em alguns minutos.' });
  });
  it('horário restrito com todos os dias bloqueados é recusado (a pessoa ficaria sem entrar)', () => {
    expect(lerFicha(form({ ...BASE, horario_semana: 'bloqueado' }))).toEqual({ ok: false, erros: { horario: 'Escolha ao menos um dia com horário.' } });
  });
  it('setor fora do formato fica no campo Setores, e a ficha manda sempre setores e níveis (vazios também)', () => {
    expect(lerFicha(form({ ...BASE, setor: ['x'] }))).toEqual({ ok: false, erros: { setores: 'Setor desconhecido' } });
    const r = lerFicha(form({ ...BASE, setor: [] }));
    // setores ausente LIMPARIA os setores no banco; níveis sempre como objeto.
    expect(r.ok && paraBanco(r.dados)).toMatchObject({ setores: [], niveis: {} });
  });
});
