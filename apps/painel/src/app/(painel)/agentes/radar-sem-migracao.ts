import { semMigracaoI1 } from '@/lib/agentes';

/** D19: sem as tabelas da I5 qualquer uma das leituras acusa a falta (o HEAD com count pode voltar sem erro). */
export function radarSemMigracao({ contagem, giro }: {
  contagem: { count: number | null; error: { code?: string } | null }; giro: { error: { code?: string } | null };
}): boolean {
  return semMigracaoI1(contagem.error) || semMigracaoI1(giro.error);
}
