'use client';

import { useState } from 'react';
import { classeCaixa, classeSelect } from '../estilos';

// Setores cujos documentos quase sempre trazem valores (boleto, folha): a caixa já vem marcada (D11).
const COM_VALORES = ['Financeiro', 'Pessoal'];

/**
 * Setor do documento e "Tem valores" (D11): o agente só manda o documento a quem pode tratar o setor dele; com valores, só a
 * quem pode ver valores. Escolher Financeiro ou Pessoal marca a caixa; nunca desmarca o que a pessoa marcou.
 */
export function CampoSetorDocumento({ setores, setorId = null, temValores = false, rotulo, rotuloValores }: {
  setores: { id: string; nome: string }[]; setorId?: string | null; temValores?: boolean; rotulo: string;
  /** Nome acessível da caixa nas linhas da lista ("Tem valores em <documento>"), para não repetir o do envio. */
  rotuloValores?: string;
}) {
  const [valores, setValores] = useState(temValores);
  const mudarSetor = (novo: string) => {
    const nome = setores.find((s) => s.id === novo)?.nome;
    if (nome && COM_VALORES.includes(nome)) setValores(true);
  };
  return (
    <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <select name="setor_id" aria-label={rotulo} defaultValue={setorId ?? ''} onChange={(e) => mudarSetor(e.target.value)} className={classeSelect}>
        <option value="">Documento da empresa (todos com acesso)</option>
        {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
      </select>
      <label className="flex items-center gap-2 whitespace-nowrap text-base text-foreground">
        <input type="checkbox" name="tem_valores" aria-label={rotuloValores} checked={valores} onChange={(e) => setValores(e.target.checked)} className={classeCaixa} />
        Tem valores (boleto, folha, salários)
      </label>
    </span>
  );
}
