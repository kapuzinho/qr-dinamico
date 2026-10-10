// Pacote binário que o site manda pro servidor com as malhas a exportar (sem nada do gerador de arquivos):
//   [u32 tamanho do cabeçalho][cabeçalho JSON (UTF-8, completado até múltiplo de 4)]
//   e, pra cada peça na ordem do cabeçalho: Float32 posições (nPos) + Uint32 índices (nIdx)
// cabeçalho: { formato: '3mf'|'zip'|'stl', nome, opcoes, partes: [{ nome, cor, nPos, nIdx }] }
const enc = new TextEncoder(), dec = new TextDecoder();

export function montarPacote(meta, partes) {
  const cab = { ...meta, partes: partes.map(p => ({ nome: p.nome, cor: p.cor ?? null, nPos: p.pos.length, nIdx: p.idx.length })) };
  let j = enc.encode(JSON.stringify(cab));
  const tamCab = Math.ceil(j.length / 4) * 4;
  let total = 4 + tamCab;
  for (const p of partes) total += p.pos.length * 4 + p.idx.length * 4;
  const buf = new ArrayBuffer(total), u8 = new Uint8Array(buf);
  new DataView(buf).setUint32(0, tamCab, true);
  u8.set(j, 4); u8.fill(32, 4 + j.length, 4 + tamCab);   // completa com espaços (JSON continua válido)
  let o = 4 + tamCab;
  for (const p of partes) {
    new Float32Array(buf, o, p.pos.length).set(p.pos); o += p.pos.length * 4;
    new Uint32Array(buf, o, p.idx.length).set(p.idx); o += p.idx.length * 4;
  }
  return u8;
}

export function lerPacote(u8, { maxPartes = 64, maxVertices = 3_000_000 } = {}) {
  if (u8.byteLength < 8) throw new Error('Pacote vazio.');
  const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  const tamCab = new DataView(buf).getUint32(0, true);
  if (tamCab > 1_000_000 || 4 + tamCab > buf.byteLength) throw new Error('Pacote inválido.');
  const meta = JSON.parse(dec.decode(new Uint8Array(buf, 4, tamCab)));
  if (!Array.isArray(meta.partes) || !meta.partes.length || meta.partes.length > maxPartes) throw new Error('Quantidade de peças inválida.');
  let o = 4 + tamCab, nV = 0;
  const partes = meta.partes.map(p => {
    const nPos = p.nPos | 0, nIdx = p.nIdx | 0;
    if (nPos % 3 || nIdx % 3 || nPos <= 0 || nIdx <= 0) throw new Error('Malha inválida.');
    nV += nPos / 3;
    if (nV > maxVertices) throw new Error('Modelo grande demais.');
    if (o + (nPos + nIdx) * 4 > buf.byteLength) throw new Error('Pacote cortado.');
    const pos = new Float32Array(buf, o, nPos); o += nPos * 4;
    const idx = new Uint32Array(buf, o, nIdx); o += nIdx * 4;
    for (let i = 0; i < idx.length; i++) if (idx[i] >= nPos / 3) throw new Error('Índice fora da malha.');
    return { nome: String(p.nome || 'peca.stl').slice(0, 120), cor: p.cor, pos, idx };
  });
  return { meta, partes };
}

