// Gerador de BR Code (Pix "copia e cola") no padrão EMV do Banco Central.
// Monta a string que, virada QR Code, é lida pelos apps de banco.

function campo(id, valor) {
  const tam = String(valor.length).padStart(2, '0');
  return `${id}${tam}${valor}`;
}

// CRC16-CCITT (polinômio 0x1021), exigido no fim do BR Code
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// remove acentos e limita tamanho (nome/cidade do Pix são ASCII)
function limpar(txt, max) {
  return (txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .,\-]/g, '').toUpperCase().slice(0, max).trim();
}

// gera o payload Pix. valor vazio/0 = o pagador digita no app.
export function gerarPix({ chave, nome, cidade = 'BRASIL', valor = '', txid = '***' }) {
  if (!chave) throw new Error('Informe a chave Pix.');
  const nomeR = limpar(nome, 25) || 'RECEBEDOR';
  const cidadeR = limpar(cidade, 15) || 'BRASIL';

  // Merchant Account Information (id 26): GUI br.gov.bcb.pix + chave
  const mai = campo('00', 'br.gov.bcb.pix') + campo('01', chave.trim());

  let payload =
    campo('00', '01') +                 // Payload Format Indicator
    campo('26', mai) +                  // conta Pix
    campo('52', '0000') +               // Merchant Category Code
    campo('53', '986') +                // moeda = BRL
    (valor && Number(valor) > 0 ? campo('54', Number(valor).toFixed(2)) : '') +
    campo('58', 'BR') +                 // país
    campo('59', nomeR) +                // nome do recebedor
    campo('60', cidadeR) +              // cidade
    campo('62', campo('05', txid));     // txid

  payload += '6304';                    // id + tam do CRC
  return payload + crc16(payload);
}
