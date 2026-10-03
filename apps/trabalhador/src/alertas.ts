import type { Repos } from '@escritorio/db';
import type { Email } from './email';
import { enviarDoSistema, type DepsEnvio } from './envio';

export type NivelAlerta = 'critico' | 'operacional' | 'aviso';

export interface Alertas {
  /** usuarioId: só aquela pessoa (e o administrador) vê no Início; sem ela, o setor. */
  alertar(a: { nivel: NivelAlerta; mensagem: string; setorId?: string | null; usuarioId?: string | null }): Promise<void>;
}

export function criarAlertas(d: { repos: Repos; email: Email; envio: DepsEnvio }): Alertas {
  return {
    async alertar(a) {
      await d.repos.registrarAlerta(a);
      if (a.nivel === 'aviso') return;
      const cfg = await d.repos.obterConfiguracoes();
      if (cfg.emailAlertas) {
        const assunto = a.nivel === 'critico' ? '[URGENTE] Sistema do escritório' : 'Aviso do sistema do escritório';
        await d.email.enviar(cfg.emailAlertas, assunto, a.mensagem).catch((e) => console.error('[email]', e));
      }
      if (a.nivel === 'operacional' && cfg.telefoneDono) {
        const conversa = await d.repos.obterOuCriarConversa(cfg.telefoneDono, null);
        await enviarDoSistema(d.envio, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'sistema', texto: `⚠️ ${a.mensagem}` })
          .catch((e) => console.error('[alerta whatsapp]', e));
      }
    },
  };
}
