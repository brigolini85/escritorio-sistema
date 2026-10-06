import type { TelaRadar } from '@/lib/radar';
import { AssuntosRadar } from './assuntos-radar';
import { AvisosRadar } from './avisos-radar';
import { FontesRadar } from './fontes-radar';
import { GirosRadar } from './giros-radar';
import { RegrasRadar } from './regras-radar';

/** A coluna da direita da imagem 00: Fontes, Assuntos vigiados, Regras do agente, Avisos e Últimos giros. */
export function ColunaRadar({ tela, dono, nomes, agoraIso }: { tela: TelaRadar; dono: boolean; nomes: Record<string, string>; agoraIso: string }) {
  const ultimo = tela.giros.find((g) => g.estado === 'concluido') ?? null;
  return (
    <>
      <FontesRadar fontes={tela.fontes} giro={ultimo} dono={dono} />
      <AssuntosRadar assuntos={tela.config.assuntos} dono={dono} />
      <RegrasRadar />
      <AvisosRadar config={tela.config} dono={dono} telefoneDono={tela.telefoneDono} />
      <GirosRadar giros={tela.giros} nomes={nomes} agoraIso={agoraIso} />
    </>
  );
}
