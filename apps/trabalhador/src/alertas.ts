import type { Repos } from '@escritorio/db';
import type { Email } from './email';
import { enviarDoSistema, type DepsEnvio } from './envio';

export type NivelAlerta = 'critico' | 'operacional' | 'aviso';

export interface Alertas {
  /** usuarioId: só aquela pessoa (e o administrador) vê no Início; sem ela, o setor. */
  /**
   * Auditoria 4.12: `entregue` é falso só quando havia e-mail ou WhatsApp configurado e todos falharam (sem nenhum dos dois,
   * o alerta fica no painel e conta como entregue). Quem não precisa saber pode ignorar o retorno.
   */
  alertar(a: { nivel: NivelAlerta; mensagem: string; setorId?: string | null; usuarioId?: string | null }): Promise<void | { entregue: boolean }>;
}

export function criarAlertas(d: { repos: Repos; email: Email; envio: DepsEnvio }): Alertas {
  return {
    async alertar(a) {
      await d.repos.registrarAlerta(a);
      if (a.nivel === 'aviso') return { entregue: true };
      const cfg = await d.repos.obterConfiguracoes();
      let tentou = false;
      let chegou = false;
      if (cfg.emailAlertas) {
        tentou = true;
        const assunto = a.nivel === 'critico' ? '[URGENTE] Sistema do escritório' : 'Aviso do sistema do escritório';
        if (await d.email.enviar(cfg.emailAlertas, assunto, a.mensagem).then(() => true, (e) => { console.error('[email]', e); return false; })) chegou = true;
      }
      if (a.nivel === 'operacional' && cfg.telefoneDono) {
        tentou = true;
        const conversa = await d.repos.obterOuCriarConversa(cfg.telefoneDono, null);
        const ok = await enviarDoSistema(d.envio, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'sistema', texto: `⚠️ ${a.mensagem}` })
          .then(() => true, (e) => { console.error('[alerta whatsapp]', e); return false; });
        if (ok) chegou = true;
      }
      return { entregue: !tentou || chegou };
    },
  };
}
