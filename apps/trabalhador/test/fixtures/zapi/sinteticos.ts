export const texto = {
  type: 'ReceivedCallback', messageId: 'MSG-TEXTO-1', phone: '5531999990001', fromMe: false, isGroup: false,
  senderName: 'João', momment: 1759000000000, text: { message: 'Preciso da guia do DAS' },
};
export const audio = {
  type: 'ReceivedCallback', messageId: 'MSG-AUDIO-1', phone: '5531999990001', fromMe: false, isGroup: false,
  audio: { audioUrl: 'https://z-api.exemplo/audio.ogg', mimeType: 'audio/ogg; codecs=opus' },
};
export const imagem = {
  type: 'ReceivedCallback', messageId: 'MSG-IMG-1', phone: '5531999990001', fromMe: false, isGroup: false,
  image: { imageUrl: 'https://z-api.exemplo/foto.jpeg', caption: 'segue o pedido', mimeType: 'image/jpeg' },
};
export const documento = {
  type: 'ReceivedCallback', messageId: 'MSG-DOC-1', phone: '5531999990001', fromMe: false, isGroup: false,
  document: { documentUrl: 'https://z-api.exemplo/extrato.pdf', fileName: 'extrato.pdf', mimeType: 'application/pdf' },
};
export const grupo = { ...texto, messageId: 'MSG-GRUPO-1', isGroup: true, phone: '120363000000000000-group' };
export const enviadaPorMim = { ...texto, messageId: 'MSG-EU-1', fromMe: true, text: { message: 'Já envio' } };
export const figurinha = {
  type: 'ReceivedCallback', messageId: 'MSG-STK-1', phone: '5531999990001', fromMe: false, isGroup: false, sticker: { stickerUrl: 'x' },
};
