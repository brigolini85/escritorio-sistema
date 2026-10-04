import { Antes } from '@/components/patterns/formulario-alteravel';
import { FormField } from '@/components/patterns/form-field';
import { CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CARGOS_SUGERIDOS } from '@/lib/usuarios';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarCargos } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';

/** Quantas pessoas ativas usam cada cargo (só o administrador lê a equipe). */
async function cargosEmUso(): Promise<[string, number][]> {
  const { data } = await (await supabaseServidor()).from('usuarios').select('cargo').eq('ativo', true).not('cargo', 'is', null);
  const conta = new Map<string, number>();
  for (const u of data ?? []) if (u.cargo) conta.set(u.cargo, (conta.get(u.cargo) ?? 0) + 1);
  return [...conta.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}

/** Lista de cargos da ficha da pessoa (spec 7.1 e seção 9, D10). Configurações: Sim. */
export async function SecaoCargos({ cfg, admin }: { cfg: Config; admin: boolean }) {
  // Homologação sem a migração (D25): a coluna não vem e vale a lista padrão.
  const cargos = cfg.cargos ?? CARGOS_SUGERIDOS;
  const emUso = admin ? await cargosEmUso() : [];
  return (
    <FormularioConfig acao={salvarCargos} rotulo="Cargos">
      <Cartao id="cargos" titulo="Cargos" descricao="A lista que o campo Cargo da ficha da pessoa sugere. É só informativo: mudar aqui não muda o cargo de quem já tem.">
        <CardContent className="flex flex-col gap-3">
          <div>
            {/* id do campo diferente do id do cartão: com os dois "cargos", o rótulo apontaria para o cartão. */}
            <FormField id="cargos-lista" rotulo="Cargos (um por linha)" ajuda="Até 30 cargos, cada um com até 60 letras.">
              <Textarea name="cargos" rows={Math.min(12, Math.max(4, cargos.length + 1))} defaultValue={cargos.join('\n')} />
            </FormField>
            <Antes campo="cargos" texto={cargos.join(', ') || 'nenhum'} />
          </div>
          {emUso.length > 0 && <p className="text-sm text-muted">Em uso na equipe: {emUso.map(([c, n]) => `${c} (${n})`).join(', ')}.</p>}
        </CardContent>
        <RodapeConfig salvar="Salvar cargos" />
      </Cartao>
    </FormularioConfig>
  );
}
