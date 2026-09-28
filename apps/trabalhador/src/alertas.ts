export type NivelAlerta = 'critico' | 'operacional' | 'aviso';

export interface Alertas {
  alertar(a: { nivel: NivelAlerta; mensagem: string; setorId?: string | null }): Promise<void>;
}
