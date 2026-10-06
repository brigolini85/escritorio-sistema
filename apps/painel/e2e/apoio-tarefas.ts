import { anexarArquivoTeste, configurarAgenteTeste, criarTarefaTeste, sqlTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, db } from './apoio';
import { SENHA } from './apoio-agentes';
import { demandaE2e, empresaE2e } from './apoio-demandas';

export const RESULTADO = { versao: 1, resumo: '3 lançamentos; Itaú conferido.', destaques: [{ rotulo: 'Lançamentos', valor: '3', detalhe: 'partidas dobradas' }],
  linhas: [{ descricao: 'Tarifa bancária', valor: 45, texto: null, fonte: 'extrato.csv', provisoria: false },
    { descricao: 'PIX Roberto Faria', valor: 3200, texto: null, fonte: 'pendência 1', provisoria: true }], observacoes: null };

/** Cláudia (Contábil), a demanda "Fechamento de outubro" e o Contábil ligado. Devolve os ids. */
export async function cenarioTarefa(p: { estado?: 'trabalhando' | 'aguardando_pendencias' | 'pronta'; pendencias?: Parameters<typeof criarTarefaTeste>[0]['pendencias'];
  resultado?: object | null; contatoProcuravel?: boolean } = {}) {
  const empresa = await empresaE2e('I3 Padaria Sol', '21448390000190');
  const d = await demandaE2e({ titulo: 'I3 Fechamento de outubro', setor: 'Contábil', clienteId: empresa });
  await configurarAgenteTeste('contabil', { estado: 'ligado' });
  const claudia = await criarUsuarioTeste({ email: 'claudia@i3.local', senha: SENHA, nome: 'Cláudia Contábil', papel: 'atendente', setores: ['Contábil'] });
  let contatoId: string | null = null;
  if (p.contatoProcuravel) {
    const c = (await db.from('contatos').insert({ nome: 'Roberto Faria', telefone: '5531999990701' }).select('id').single()).data!;
    contatoId = c.id;
    await db.from('contato_clientes').insert({ contato_id: c.id, cliente_id: empresa, perfil: 'personalizado' } as never);
    const setor = (await db.from('setores').select('id').eq('nome', 'Contábil').single()).data!.id;
    await db.from('contato_cliente_setores').insert({ contato_id: c.id, cliente_id: empresa, setor_id: setor, pode_ser_procurado: true } as never);
  }
  const t = await criarTarefaTeste({ chamadoId: d.id, pedidaPor: claudia, pedido: 'Fazer o fechamento de outubro', estado: p.estado ?? 'aguardando_pendencias',
    etapas: ['Coletar documentos', 'Ler e lançar', 'Revisar pendências', 'Aprovação'], resultado: p.resultado ?? null, pendencias: p.pendencias ?? [] });
  await sqlTeste(`update public.agente_tarefas set etapas = jsonb_set(etapas, '{0}', etapas -> 0 || '{"concluida": true, "resumo": "3 arquivos"}'), etapa_atual = 2,
    custo_usd = 0.86, custo_etapas = '{"1": 0.52, "2": 0.34}' where id = $1`, [t.id]);
  await anexarArquivoTeste(t.id, { nome: 'extrato.csv', conteudo: 'data;valor\n05/10;-45,00', lido: true });
  return { empresa, demanda: d, claudia, tarefa: t, contatoId };
}
