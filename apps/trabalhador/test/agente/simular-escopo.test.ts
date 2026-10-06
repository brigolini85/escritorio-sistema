import { beforeEach, describe, expect, it } from 'vitest';
import { configurarAgenteTeste, limparBanco, sqlTeste } from '@escritorio/db/teste';
import { processarSimulacao } from '../../src/agente/simular';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { db, repos, setorId } from '../apoio/cenario';
import { criarUsuarioTeste } from '../apoio/usuario';

// I3b, Task 9 (minor) / Task 15: no Testar de um agente de setor, ler_demandas_setor mostra só as demandas que a pessoa que testa vê no painel.
const deps = (ia: IaRoteirizada) => ({ repos, ia, envio: {} as never, prazoMs: 60_000 });
const TITULO = 'Guia do DAS de setembro (escopo)';

async function testarComo(usuarioId: string, empresa: string): Promise<string> {
  const agente = (await db.from('agentes').select('id').eq('slug', 'fiscal').single()).data!.id;
  const [s] = await sqlTeste<{ id: string }>(`insert into public.simulacoes_agente (usuario_id, mensagem, agente_id, cliente_id, modo)
    values ($1, 'Quais demandas do Fiscal estão abertas?', $2, $3, 'por_tras') returning id`, [usuarioId, agente, empresa]);
  const ia = new IaRoteirizada([
    usarFerramentas({ nome: 'ler_demandas_setor', entrada: {} }),
    usarFerramentas({ nome: 'devolver_resposta', entrada: { resposta_ao_cliente: 'Conferi.', para_a_equipe: null } }),
    fim(),
  ]);
  expect(await processarSimulacao(deps(ia), s!.id, true)).toBe('pronta');
  // O resultado da ferramenta volta na segunda chamada da IA.
  return JSON.stringify(ia.recebidos[1]!.messages.at(-1));
}

describe('Testar do Fiscal: ler_demandas_setor com o escopo de quem testa (I3b)', () => {
  beforeEach(async () => {
    await limparBanco();
    await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
    await configurarAgenteTeste('fiscal', { estado: 'desligado', modo: 'mesma_voz', ferramentas: ['ler_demandas_setor'] });
  });

  it('quem não vê o setor Fiscal não recebe as demandas dele; quem vê, recebe', async () => {
    const empresa = (await db.from('clientes').insert({ razao_social: 'Padaria Escopo', cnpj: '55443322000155' }).select('id').single()).data!.id;
    await db.from('chamados').insert({ cliente_id: empresa, setor_id: await setorId('Fiscal'), titulo: TITULO });
    const semSetor = await criarUsuarioTeste({ email: 'pessoal-escopo@i3b.local', papel: 'atendente', setores: ['Pessoal'] });
    const doSetor = await criarUsuarioTeste({ email: 'fiscal-escopo@i3b.local', papel: 'atendente', setores: ['Fiscal'] });
    expect(await testarComo(semSetor, empresa)).not.toContain(TITULO);
    expect(await testarComo(doSetor, empresa)).toContain(TITULO);
  });
});
