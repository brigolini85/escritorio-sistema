'use client';

import { Archive, ArchiveRestore, TriangleAlert } from 'lucide-react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { AJUDA_EXCLUIR, textosDaJanela, type TextosJanela, type TipoCadastro } from '@/lib/arquivo';
import { arquivarCadastro, consultarUso, excluirCadastroDeVez, restaurarCadastro } from '@/lib/arquivo-acoes';
import { ConfirmDialog } from './confirm-dialog';

const FALHA = 'Não consegui concluir agora. Tente de novo.';

/**
 * O único "Excluir…" dos cadastros (spec 5.1): consulta o uso no banco ao clicar e abre a janela certa.
 * Com histórico, ou para quem não é administrador, arquiva. Nunca usado e administrador, exclui de vez digitando o nome.
 */
export function ExcluirCadastro({ tipo, id, nome, variante = 'icone', voltarPara }: {
  tipo: TipoCadastro; id: string; nome: string; variante?: 'icone' | 'area'; voltarPara?: string;
}) {
  const router = useRouter();
  const [janela, setJanela] = useState<TextosJanela | null>(null);
  const [aberto, setAberto] = useState(false);
  const [consultando, iniciar] = useTransition();

  // Sem "disabled" no botão: desabilitar tira o foco, e a janela precisa devolvê-lo ao botão quando fechar.
  const abrir = () => !consultando && iniciar(async () => {
    try {
      const r = await consultarUso(tipo, id);
      if (!r.ok) { toast.error(r.erro); return; }
      setJanela(textosDaJanela(tipo, r.uso, r.admin));
      setAberto(true);
    } catch (e) {
      unstable_rethrow(e);
      console.error('[arquivo] falha ao consultar o uso', e);
      toast.error(FALHA);
    }
  });

  const confirmar = async () => {
    if (!janela) return;
    try {
      const r = janela.modo === 'excluir' ? await excluirCadastroDeVez(tipo, id) : await arquivarCadastro(tipo, id);
      if (!r.ok) { toast.error(r.erro); return; }
      toast.success(janela.modo === 'excluir' ? `Excluído de vez: ${nome}.` : `Arquivado: ${nome}.`);
      if (voltarPara) router.push(voltarPara);
      else router.refresh();
    } catch (e) {
      unstable_rethrow(e);
      console.error('[arquivo] falha ao arquivar ou excluir', e);
      toast.error(FALHA);
    }
  };

  const botao = variante === 'icone' ? (
    <Button type="button" variant="outline" size="icon" onClick={abrir} aria-busy={consultando} aria-label={`Arquivar ou excluir ${nome}`}>
      <Archive aria-hidden size={16} strokeWidth={1.75} />
    </Button>
  ) : (
    <Button type="button" variant="outline" size="sm" onClick={abrir} aria-busy={consultando}>Excluir…</Button>
  );

  return (
    <>
      {variante === 'area' ? (
        <section aria-label="Excluir…" className="flex flex-col items-start gap-2 rounded-md border border-border p-4">
          <p className="text-sm text-muted">{AJUDA_EXCLUIR}</p>
          {botao}
        </section>
      ) : botao}
      {janela && (
        <ConfirmDialog
          aberto={aberto}
          aoMudarAberto={setAberto}
          tipo={janela.modo}
          titulo={<>{janela.verbo} <strong className="font-extrabold">{nome}</strong>?</>}
          descricao={(
            <>
              {janela.descricao}
              {janela.aviso && (
                <span className="mt-2 flex items-center justify-center gap-1.5 font-semibold text-danger">
                  <TriangleAlert aria-hidden size={16} strokeWidth={1.75} />
                  {janela.aviso}
                </span>
              )}
            </>
          )}
          confirmar={janela.confirmar}
          enviando={janela.enviando}
          digitarParaConfirmar={janela.modo === 'excluir' ? nome : undefined}
          acao={confirmar}
        />
      )}
    </>
  );
}

/** Restaurar não é destrutivo: volta na hora, sem janela. */
export function BotaoRestaurar({ tipo, id, nome }: { tipo: TipoCadastro; id: string; nome: string }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const restaurar = () => iniciar(async () => {
    try {
      const r = await restaurarCadastro(tipo, id);
      if (!r.ok) { toast.error(r.erro); return; }
      toast.success(`Restaurado: ${nome}.`);
      router.refresh();
    } catch (e) {
      unstable_rethrow(e);
      console.error('[arquivo] falha ao restaurar', e);
      toast.error(FALHA);
    }
  });
  return (
    <Button type="button" variant="outline" size="sm" onClick={restaurar} disabled={enviando} aria-label={`Restaurar ${nome}`}>
      <ArchiveRestore aria-hidden size={16} strokeWidth={1.75} />
      {enviando ? 'Restaurando…' : 'Restaurar'}
    </Button>
  );
}
