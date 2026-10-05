'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { CANAIS_AVISO, perfilDasMarcas, type MarcasAcesso, type Perfil } from '@escritorio/core';
import { lerDisponiveis } from '@/lib/acesso-contato';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const Uuid = z.string().uuid('Setor inválido.');
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const Dados = z.object({
  marcas: z.object({
    setores: z.array(z.object({ setorId: Uuid, podeSerProcurado: z.boolean() })).max(50),
    podePedirNota: z.boolean(), podeAtualizarPreco: z.boolean(), verValores: z.boolean(), receberDocumentos: z.boolean(),
    avisarDocumentoNovo: z.array(z.enum(CANAIS_AVISO)).max(2), recebeAlertasAcesso: z.boolean(),
  }),
  contato: z.object({
    nome: z.string().trim().min(2, 'Informe o nome do contato.').max(120, 'Nome com até 120 letras.'),
    cargo: z.string().trim().max(80, 'Cargo com até 80 letras.'),
    email: z.string().trim().max(200, 'E-mail inválido.').refine((v) => v === '' || EMAIL.test(v), 'E-mail inválido.'),
  }).optional(),
});
export type DadosAcesso = { marcas: MarcasAcesso; contato?: { nome: string; cargo: string; email: string } };
export type ResultadoAcesso = { ok: true; perfil: Perfil } | { ok: false; erro: string };

const FALHA = 'Não foi possível salvar agora. Tente de novo.';

/**
 * O SALVAR do bloco de acesso (ficha e Contatos, D23). Mesma permissão de hoje para as marcações (Clientes "Ver e editar");
 * o banco confere de novo e grava tudo numa transação. O perfil é o das marcações, calculado aqui (D6): o do navegador não conta.
 */
export async function salvarAcessoContato(contatoId: string, clienteId: string, dados: DadosAcesso): Promise<ResultadoAcesso> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erro: 'Você não tem permissão para editar contatos.' };
  if (!z.string().uuid().safeParse(contatoId).success || !z.string().uuid().safeParse(clienteId).success) return { ok: false, erro: 'Contato ou empresa inválidos.' };
  const v = Dados.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? 'Dados inválidos.' };
  const { marcas, contato } = v.data;
  try {
    const sb = await supabaseServidor();
    const perfil = perfilDasMarcas(marcas, await lerDisponiveis(sb, clienteId, marcas.setores.map((s) => s.setorId)));
    const { error } = await sb.rpc('salvar_acesso_contato', {
      p_contato: contatoId, p_cliente: clienteId,
      p_dados: {
        perfil, setores: marcas.setores.map((s) => ({ setor_id: s.setorId, pode_ser_procurado: s.podeSerProcurado })),
        pode_pedir_nota: marcas.podePedirNota, pode_atualizar_preco: marcas.podeAtualizarPreco, ver_valores: marcas.verValores,
        receber_documentos: marcas.receberDocumentos, avisar_documento_novo: marcas.avisarDocumentoNovo, recebe_alertas_acesso: marcas.recebeAlertasAcesso,
        ...(contato ? { contato } : {}),
      },
    });
    if (error) {
      // Só o "raise exception" do banco (P0001) é frase para a pessoa.
      if (error.code !== 'P0001') console.error('[acesso] falha ao salvar', error);
      return { ok: false, erro: error.code === 'P0001' ? mensagemDoBanco(error.message) : FALHA };
    }
    // O acesso aparece na ficha, em Contatos e (nota/preço) no painel direito do Atendimento.
    revalidatePath('/contatos');
    revalidatePath(`/clientes/${clienteId}`);
    revalidatePath('/atendimento', 'layout');
    return { ok: true, perfil };
  } catch (e) {
    // Redirecionamento do Next (sessão) segue; o resto vira a frase fixa.
    unstable_rethrow(e);
    console.error('[acesso] falha ao salvar', e);
    return { ok: false, erro: FALHA };
  }
}
