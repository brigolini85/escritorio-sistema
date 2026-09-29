import { limparBanco } from '@escritorio/db/teste';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId } from '../../test/apoio/cenario';
import { criarUsuarioTeste } from '../../test/apoio/usuario';
import { criarClienteIa } from '../agente/cliente-ia';
import { montarPedidoNota, montarPedidoVenda } from '../agente/pedido-nota';
import { processarAssistente } from '../assistente/processar';
import { CanalFalso } from '../canal/falso';

type CenarioAssistente = {
  nome: string; papel?: 'admin' | 'atendente'; permissoes?: string[]; setores?: string[];
  rodadas: string[]; canal?: 'site' | 'whatsapp';
  espera: { respostaContem?: string[]; quantidadeFinal?: number; arquivoCsv?: boolean; semAlteracao?: boolean };
};

const CENARIOS: CenarioAssistente[] = [
  { nome: 'lista as notas abertas', rodadas: ['quais notas estão abertas?'], espera: { respostaContem: ['#'] } },
  { nome: 'total vendido para a rede', rodadas: ['quanto vendi pro Supermercado Brasil em setembro de 2026?'], espera: { respostaContem: ['95'] } },
  { nome: 'corrige a quantidade só depois do sim e manda o CSV no WhatsApp', canal: 'whatsapp', permissoes: ['assistente_whatsapp'],
    rodadas: ['o pedido {N} era 15 PAC de costela, corrige e me manda o CSV', 'sim, pode gravar'], espera: { quantidadeFinal: 15, arquivoCsv: true } },
  { nome: 'atendente sem permissão não corrige', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_site'],
    rodadas: ['o pedido {N} era 15 PAC, corrige', 'sim, pode'], espera: { semAlteracao: true, respostaContem: ['permiss'] } },
];

async function rodar(c: CenarioAssistente): Promise<string[]> {
  await limparBanco();
  await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
  const canalAssistente = c.canal ?? 'site';
  const usuarioId = await criarUsuarioTeste({ email: 'cenario@assistente.local', papel: c.papel ?? 'admin', permissoes: c.permissoes ?? ['assistente_site'],
    setores: c.setores, telefone: '5531988887777' });
  const { empresas } = await contatoComEmpresas(['Indústria X']);
  const cad = await criarCadastrosExemplo(empresas[0]!.id);
  const efigenia = (await repos.unidadesDaEmpresa(empresas[0]!.id, 'cliente')).find((u) => u.id === cad.brasilEfigenia)!;
  const costela = (await repos.produtosDaEmpresa(empresas[0]!.id)).find((p) => p.id === cad.costela)!;
  const itens = [{ produto: costela, texto: 'costela', quantidade: 10, unidade: 'PAC', preco: 9.5 }];
  const { titulo, resumo } = montarPedidoNota({ tipo: 'venda', destino: efigenia, textoDestinatario: 'Brasil', itens, pedidoOriginal: '10 PAC costela', semPermissao: false });
  const agora = new Date();
  const { id: chamadoId, numero } = await repos.abrirChamado({ clienteId: empresas[0]!.id, conversaId: null, setorId: await setorId('Fiscal'), responsavelId: null, titulo, resumo, foraDoContrato: false, origem: 'agente' });
  await repos.anexarPedidoVenda(chamadoId, { ...montarPedidoVenda({ agora, destino: efigenia, textoDestinatario: 'Brasil', itens, extras: {} }), data: '15/09/2026' });
  await db.from('chamados').update({ criado_em: '2026-09-15T15:00:00Z' }).eq('id', chamadoId);

  const canal = new CanalFalso();
  const deps = { repos, ia: criarClienteIa(process.env.ANTHROPIC_API_KEY!), canal };
  const resultados: string[] = [];
  for (const texto of c.rodadas) {
    await repos.registrarMensagemAssistente({ usuarioId, canal: canalAssistente, conversaId: null, papel: 'usuario', conteudo: texto.replace('{N}', String(numero)) });
    resultados.push(await processarAssistente(deps, { usuarioId, canal: canalAssistente, conversaId: null, telefone: canalAssistente === 'whatsapp' ? '553188887777' : null }, true));
  }
  const respostas = (await repos.historicoAssistente(usuarioId, canalAssistente, null, 50)).filter((m) => m.papel === 'assistente').map((m) => m.conteudo).join('\n');
  const pedido = (await db.from('chamados').select('pedido_venda').eq('id', chamadoId).single()).data!.pedido_venda as { itens: { quantidade: number }[] };
  const falhas: string[] = [];
  for (const t of c.espera.respostaContem ?? []) if (!respostas.toLowerCase().includes(t.toLowerCase())) falhas.push(`resposta deveria conter "${t}": ${respostas}`);
  if (c.espera.quantidadeFinal !== undefined && pedido.itens[0]!.quantidade !== c.espera.quantidadeFinal) falhas.push(`quantidade final ${pedido.itens[0]!.quantidade}`);
  if (c.espera.semAlteracao && pedido.itens[0]!.quantidade !== 10) falhas.push('não deveria alterar o pedido');
  if (c.espera.arquivoCsv && canal.arquivosEnviados.length !== 1) falhas.push(`esperava 1 CSV no WhatsApp; enviados ${canal.arquivosEnviados.length}`);
  if (falhas.length) falhas.push(`resultados: ${resultados.join(',')}; respostas do assistente: ${respostas}`);
  return falhas;
}

async function principal() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('Falta a ANTHROPIC_API_KEY no .env.'); process.exit(1); }
  let falhou = 0;
  for (const c of CENARIOS) {
    const falhas = await rodar(c).catch((e: Error) => [`erro: ${e.message}`]);
    if (falhas.length) falhou++;
    console.log(`${falhas.length ? '❌' : '✅'} ${c.nome}${falhas.length ? `\n   - ${falhas.join('\n   - ')}` : ''}`);
  }
  console.log(`\n${CENARIOS.length - falhou}/${CENARIOS.length} cenários do assistente passaram`);
  process.exit(falhou ? 1 : 0);
}

void principal();
