import { obterUsuario } from '@/lib/sessao';
import { MinhaMesa } from './minha-mesa';
import { PainelSituacao } from './painel-situacao';

/**
 * Início (spec 7C.1): o papel escolhe a versão (D1). Administrador → Painel de situação (custos, sinais de vida, pausa do
 * agente); qualquer outra pessoa → Minha mesa, que nunca lê custo nem configuracoes (atendente nunca vê custos).
 */
export default async function Inicio() {
  const u = await obterUsuario();
  return u.papel === 'admin' ? <PainelSituacao u={u} /> : <MinhaMesa u={u} />;
}
