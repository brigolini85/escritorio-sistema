import { criarCanalZapi } from './zapi';
import type { CanalWhatsApp, MensagemRecebida } from './tipos';

/** Canal para testes: interpreta como a Z-API e guarda o que seria enviado. */
export class CanalFalso implements CanalWhatsApp {
  enviados: { telefone: string; texto?: string; arquivo?: string }[] = [];
  conectado = true;
  falharEnvio = false;
  private contador = 0;
  private readonly interpretador = criarCanalZapi({ instancia: 'x', token: 'x', clientToken: 'x' });

  interpretarWebhook(corpo: unknown): MensagemRecebida | null {
    return this.interpretador.interpretarWebhook(corpo);
  }
  async enviarTexto(telefone: string, texto: string) {
    if (this.falharEnvio) throw new Error('falha simulada');
    this.enviados.push({ telefone, texto });
    return { idProvedor: `FALSO-${++this.contador}` };
  }
  async enviarArquivo(telefone: string, arquivo: { url: string; nome: string }) {
    if (this.falharEnvio) throw new Error('falha simulada');
    this.enviados.push({ telefone, arquivo: arquivo.nome });
    return { idProvedor: `FALSO-${++this.contador}` };
  }
  async status() {
    return { conectado: this.conectado };
  }
}
