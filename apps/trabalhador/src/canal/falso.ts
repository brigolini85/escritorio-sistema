import { criarCanalZapi } from './zapi';
import { EnvioIncerto, type CanalWhatsApp, type MensagemRecebida } from './tipos';

/** Canal para testes: interpreta como a Z-API e guarda o que seria enviado. */
export class CanalFalso implements CanalWhatsApp {
  enviados: { telefone: string; texto?: string; arquivo?: string }[] = [];
  /** O que foi passado como arquivo (link ou conteúdo em Base64), para conferir nos testes. */
  arquivosEnviados: { nome: string; url: string }[] = [];
  conectado = true;
  falharEnvio = false;
  /** Falha só o envio de arquivo (o texto passa). */
  falharArquivo = false;
  /** Auditoria 3.2: entrega e depois estoura o prazo (a mensagem saiu, mas o envio não sabe). */
  incertoDepoisDeEnviar = false;
  private contador = 0;
  private readonly interpretador = criarCanalZapi({ instancia: 'x', token: 'x', clientToken: 'x' });

  interpretarWebhook(corpo: unknown): MensagemRecebida | null {
    return this.interpretador.interpretarWebhook(corpo);
  }
  async enviarTexto(telefone: string, texto: string) {
    if (this.falharEnvio) throw new Error('falha simulada');
    this.enviados.push({ telefone, texto });
    if (this.incertoDepoisDeEnviar) throw new EnvioIncerto('Z-API sem resposta no prazo (simulado)');
    return { idProvedor: `FALSO-${++this.contador}` };
  }
  async enviarArquivo(telefone: string, arquivo: { url: string; nome: string }) {
    if (this.falharEnvio || this.falharArquivo) throw new Error('falha simulada');
    this.enviados.push({ telefone, arquivo: arquivo.nome });
    this.arquivosEnviados.push({ nome: arquivo.nome, url: arquivo.url });
    if (this.incertoDepoisDeEnviar) throw new EnvioIncerto('Z-API sem resposta no prazo (simulado)');
    return { idProvedor: `FALSO-${++this.contador}` };
  }
  async status() {
    return { conectado: this.conectado };
  }
}
