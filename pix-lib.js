// Pix "copia e cola" (BR Code estático, padrão EMV do Banco Central) + validação de chaves.
// Funciona no navegador (window.PixLib) e no servidor (import).
(function (raiz) {
  const tira = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const campo = (id, valor) => { const v = String(valor); return id + String(v.length).padStart(2, '0') + v; };

  function crc16(txt) {                              // CRC16-CCITT (0xFFFF, polinômio 0x1021)
    let crc = 0xffff;
    for (let i = 0; i < txt.length; i++) {
      crc ^= txt.charCodeAt(i) << 8;
      for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  const limparNome = (s, max) => tira(s).toUpperCase().replace(/[^A-Z0-9 .\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

  // { chave, nome, cidade, valor?, descricao?, txid? }
  function payload({ chave, nome, cidade, valor, descricao, txid }) {
    let mai = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
    const desc = tira(descricao || '').replace(/[^\w .,\-/]/g, '').trim();
    if (desc) mai += campo('02', desc.slice(0, Math.max(0, 99 - 4 - mai.length - 4)));
    let p = campo('00', '01') + campo('01', '11') + campo('26', mai) + campo('52', '0000') + campo('53', '986');
    if (valor != null && Number(valor) > 0) p += campo('54', Number(valor).toFixed(2));
    p += campo('58', 'BR') + campo('59', limparNome(nome, 25) || 'RECEBEDOR') + campo('60', limparNome(cidade, 15) || 'BRASILIA');
    const tx = String(txid || '***').replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***';
    p += campo('62', campo('05', tx));
    p += '6304';
    return p + crc16(p);
  }

  // ---------- chaves ----------
  const digitos = s => String(s || '').replace(/\D/g, '');
  function cpfValido(c) {
    c = digitos(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (const t of [9, 10]) { let s = 0; for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i); if (((s * 10) % 11) % 10 !== +c[t]) return false; }
    return true;
  }
  function cnpjValido(c) {
    c = digitos(c); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const calc = n => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += +c[i] * p[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +c[12] && calc(13) === +c[13];
  }
  // devolve { ok, chave (normalizada), erro }
  function normalizarChave(tipo, valor) {
    const v = String(valor || '').trim();
    if (tipo === 'cpf') return cpfValido(v) ? { ok: true, chave: digitos(v) } : { ok: false, erro: 'CPF inválido.' };
    if (tipo === 'cnpj') return cnpjValido(v) ? { ok: true, chave: digitos(v) } : { ok: false, erro: 'CNPJ inválido.' };
    if (tipo === 'email') { const e = v.toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 77 ? { ok: true, chave: e } : { ok: false, erro: 'E-mail inválido.' }; }
    if (tipo === 'telefone') {
      let d = digitos(v); if (d.length === 10 || d.length === 11) d = '55' + d;
      return /^55\d{10,11}$/.test(d) ? { ok: true, chave: '+' + d } : { ok: false, erro: 'Telefone inválido: use DDD + número.' };
    }
    if (tipo === 'aleatoria') { const a = v.toLowerCase(); return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a) ? { ok: true, chave: a } : { ok: false, erro: 'Chave aleatória inválida (formato 0000aaaa-0000-...).' }; }
    return { ok: false, erro: 'Escolha o tipo da chave.' };
  }
  function mascarar(tipo, c) {
    c = String(c || '');
    if (tipo === 'cpf') return `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**`;
    if (tipo === 'cnpj') return `**.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-**`;
    if (tipo === 'email') { const [u, d] = c.split('@'); return `${u.slice(0, 1)}***@${d}`; }
    if (tipo === 'telefone') return `+55 (${c.slice(3, 5)}) *****-${c.slice(-4)}`;
    if (tipo === 'aleatoria') return `${c.slice(0, 4)}****-****-****-${c.slice(-4)}`;
    return '***';
  }
  const TIPOS = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Telefone', aleatoria: 'Aleatória' };

  const lib = { payload, crc16, normalizarChave, mascarar, cpfValido, cnpjValido, TIPOS };
  if (typeof module === 'object' && module.exports) module.exports = lib;
  raiz.PixLib = lib;
})(typeof window !== 'undefined' ? window : globalThis);
