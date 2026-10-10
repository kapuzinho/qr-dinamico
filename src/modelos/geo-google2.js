// Placa de Avaliação Google v2 — placa com área branca em onda, dois quadrados de encaixe
// (QR Code gerado pelo link + NFC), G do Google colorido (encaixe ou junto) e suporte de apoio.
import { M } from '../core/motor.js';
import { retArred } from './geo.js';
import { arrumarNaMesa } from './geo4.js';
import G_PTS from './google-g.js';

const CS = () => M().CrossSection, MAN = () => M().Manifold;
const poli = pts => new (CS())([pts], 'NonZero');
const extr = (cs, z0, z1) => cs.extrude(z1 - z0).translate([0, 0, z0]);
export const caber = (cs, w, h) => { const b = cs.bounds(); const e = Math.min(w / (b.max[0] - b.min[0]), h / (b.max[1] - b.min[1])); return cs.scale([e, e]); };
const centroEm = (cs, x, y) => { const b = cs.bounds(); return cs.translate([x - (b.min[0] + b.max[0]) / 2, y - (b.min[1] + b.max[1]) / 2]); };
const uniao = l => { const v = l.filter(Boolean); return v.length ? CS().union(v) : null; };
const pol = cs => (cs ? cs.toPolygons() : []);

// curva da onda (medida da placa original), normalizada: -1..1 ao longo da largura útil
const ONDA = [-3.47, -0.4, 2.02, 3.78, 4.79, 5.01, 4.64, 3.6, 2.06, 0.34, -1.09, -1.59, -1.01].map(v => (v - 0.77) / 4.24);
function ondaF(t) {
  const n = ONDA.length - 1, x = Math.max(0, Math.min(1, t)) * n, i = Math.min(n - 1, Math.floor(x)), u = x - i;
  const p0 = ONDA[Math.max(0, i - 1)], p1 = ONDA[i], p2 = ONDA[i + 1], p3 = ONDA[Math.min(n, i + 2)];
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}
function estrela(r) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([rr * Math.cos(a), rr * Math.sin(a)]); }
  return poli(pts);
}
function arco(r, e, a0, a1, n = 32) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([(r + e / 2) * Math.cos(a), (r + e / 2) * Math.sin(a)]); }
  for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; pts.push([(r - e / 2) * Math.cos(a), (r - e / 2) * Math.sin(a)]); }
  return poli(pts);
}
// G do Google em 4 cores, centrado na origem, raio externo Ro
export function gGoogle(Ro) {
  const s = Ro / (12.95 / 13);
  return Object.fromEntries(Object.entries(G_PTS).map(([k, pts]) => [k, poli(pts.map(([x, y]) => [x * s, y * s]))]));
}
// ícone do quadrado NFC: ondas + "NFC" + anel
export function iconeNFC(lado, txtNFC) {
  const l = lado, partes = [];
  partes.push(CS().circle(l * 0.42 + 0.45, 96).subtract(CS().circle(l * 0.42 - 0.45, 96)));
  const cy = -l * 0.02, e = Math.max(1.1, l * 0.04);
  partes.push(CS().circle(e * 0.85, 32).translate([0, cy]));
  for (const k of [0.12, 0.2, 0.28]) partes.push(arco(l * k, e, Math.PI * 0.25, Math.PI * 0.75).translate([0, cy]));
  if (txtNFC) partes.push(centroEm(caber(txtNFC, l * 0.38, l * 0.15), 0, -l * 0.2));
  return CS().union(partes);
}
// suporte (pé): borda reta encaixa no canal de trás da placa
function suporte2d(w, L) {
  const ry = Math.min(L * 0.3, w / 2), pts = [[-w / 2, 0], [w / 2, 0]];
  for (let i = 0; i <= 40; i++) { const a = Math.PI * i / 40; pts.push([(w / 2) * Math.cos(a), -(L - ry) - ry * Math.sin(a)]); }
  const furo = retArred(w * 0.18, L * 0.54, Math.min(w * 0.09, 3.5)).translate([0, -L * (0.173 + 0.27)]);
  return poli(pts).subtract(furo);
}

// ---------- layout 2D da frente da placa ----------
export function layoutGoogle2(f, p) {
  const W = p.largura, H = p.altura, m = p.margem;
  const placa = retArred(W, H, p.raio);
  // área branca de baixo com o topo em onda
  const yMid = -H / 2 + p.altArea, xi0 = -W / 2 + m, xi1 = W / 2 - m;
  const pts = [];
  for (let i = 0; i <= 60; i++) { const x = xi0 - 1 + (xi1 - xi0 + 2) * i / 60; pts.push([x, yMid + p.onda * ondaF((x - xi0) / (xi1 - xi0))]); }
  pts.push([xi1 + 1, -H / 2 - 1], [xi0 - 1, -H / 2 - 1]);
  const area = retArred(W - 2 * m, H - 2 * m, Math.max(0.5, p.raioArea)).intersect(poli(pts));
  let yOndaMin = Infinity; for (let i = 0; i <= 40; i++) yOndaMin = Math.min(yOndaMin, yMid + p.onda * ondaF(i / 40));
  let yOndaMax = -Infinity; for (let i = 0; i <= 40; i++) yOndaMax = Math.max(yOndaMax, yMid + p.onda * ondaF(i / 40));

  // círculo do logo (em cima, à esquerda)
  const R = p.diamCirculo / 2, cx = -W / 2 + m + 5.5 + R, cy = H / 2 - m - 2.6 - R;
  if (cy - R < yOndaMax + 1) throw new Error('O círculo do logo encostou na onda. Diminua o círculo ou a altura da área branca.');
  const disco = CS().circle(R, 128).translate([cx, cy]);
  const gPartes = Object.fromEntries(Object.entries(gGoogle(p.tamG / 2)).map(([k, cs]) => [k, cs.translate([cx, cy])]));
  if (p.tamG / 2 > R - 1) throw new Error('O G ficou maior que o círculo. Diminua o tamanho do G.');

  // coluna da direita: texto + estrelas, centralizados na altura do círculo
  const x0 = cx + R + p.espaco, x1 = W / 2 - m - 1, colW = x1 - x0, colX = (x0 + x1) / 2;
  if (colW < 15) throw new Error('Sem espaço pro texto. Aumente a largura da placa ou diminua o círculo.');
  const linhas = f.linhas.filter(Boolean).map(l => caber(l, colW, p.altTexto));
  const gapL = p.altTexto * 0.45;
  const n = p.nEstrelas; let s = p.tamEstrela, passo = s * 1.32;
  if (n > 0 && (n - 1) * passo + s > colW) { const k = colW / ((n - 1) * passo + s); s *= k; passo *= k; }
  const hLinhas = linhas.reduce((a, l) => { const b = l.bounds(); return a + (b.max[1] - b.min[1]); }, 0) + Math.max(0, linhas.length - 1) * gapL;
  const hTotal = hLinhas + (n > 0 ? (linhas.length ? gapL * 1.6 : 0) + s : 0);
  let y = cy + hTotal / 2;
  const txt = [];
  for (const l of linhas) { const b = l.bounds(), h = b.max[1] - b.min[1]; txt.push(centroEm(l, colX, y - h / 2)); y -= h + gapL; }
  if (linhas.length) y += gapL - gapL * 1.6;
  const est = [];
  for (let i = 0; i < n; i++) est.push(estrela(s / 2).translate([colX - (n - 1) * passo / 2 + i * passo, y - s / 2]));

  // dois quadrados de encaixe (QR à esquerda / NFC à direita, ou trocados)
  const lado = p.ladoQuadrado, dentro = lado + 2 * p.folgaQuadrado, fr = 0.45;
  const qy = (-H / 2 + m + yOndaMin) / 2, qx = W * 0.23;
  if (qy + dentro / 2 + fr > yOndaMin - 0.5 || qx - dentro / 2 - fr < 0.5 || qx + dentro / 2 + fr > W / 2 - m - 0.5)
    throw new Error('Os quadrados não cabem na área branca. Aumente a placa / a área branca ou diminua os quadrados.');
  const posQR = p.qrDireita ? qx : -qx, posNFC = -posQR;
  const moldura = (x) => retArred(dentro + 2 * fr, dentro + 2 * fr, 1.4).subtract(retArred(dentro, dentro, 1)).translate([x, qy]);
  return {
    placa, area, disco, gPartes, R, cx, cy, texto: uniao(txt), estrelas: uniao(est),
    molduras: CS().union([moldura(posQR), moldura(posNFC)]), qr: { x: posQR, y: qy }, nfc: { x: posNFC, y: qy }, lado,
  };
}

// ---------- 3D ----------
export function geoPlacaGoogle2(f, p) {
  const L = layoutGoogle2(f, p);
  const W = p.largura, H = p.altura, eP = p.espPlaca, eF = p.espFaixa, eC = Math.min(0.4, eF - 0.2);
  const gUniao = CS().union(Object.values(L.gPartes));
  const separado = p.modoG === 'encaixe';

  // corpo
  const lc = p.largSuporte + 2 * p.folgaSuporte, ec = p.espSuporte + 2 * p.folgaSuporte, yCanal = -H / 2 + p.alturaCanal;
  if (p.profCanal > eP - 1.2) throw new Error('O canal do suporte está fundo demais pra espessura da placa.');
  if (lc > W - 6) throw new Error('O suporte está mais largo que a placa.');
  const canal = MAN().cube([lc, ec, p.profCanal + 1], true).translate([0, yCanal, (p.profCanal - 1) / 2]);
  const placa = extr(L.placa, 0, eP).subtract(canal);
  const furoG = separado ? gUniao.offset(p.folgaG, 'Round') : gUniao;
  const claros2d = L.area.add(L.disco.subtract(furoG));
  let faixa2d = L.placa.subtract(L.area).subtract(L.disco);
  if (L.estrelas) faixa2d = faixa2d.subtract(L.estrelas);
  const corpo = [
    ['placa', placa],
    ['faixa', extr(faixa2d, eP, eP + eF)],
    ['claros', MAN().union([extr(claros2d, eP, eP + eC), extr(L.molduras, eP, eP + eC + 0.2)])],
  ];
  if (L.estrelas) corpo.push(['estrelas', extr(L.estrelas, eP, eP + eF + p.relevoEstrelas)]);
  if (L.texto) corpo.push(['texto', extr(L.texto, eP + eF, eP + eF + p.relevoTexto)]);
  const ids = { vermelho: 'gVermelho', amarelo: 'gAmarelo', verde: 'gVerde', azul: 'gAzul' };
  const gMont = Object.entries(L.gPartes).map(([k, cs]) => [ids[k], extr(cs, eP, eP + eF)]);
  if (!separado) corpo.push(...gMont);

  // quadrados (modelados de frente pra cima; na mesa vão virados, frente lisa no vidro)
  const eQ = p.espQuadrado, inl = Math.min(p.profInlay, eQ - 0.4);
  const base = retArred(L.lado, L.lado, 1);
  const ladoQR = L.lado - 2 * p.margemQR;
  const qr = caber(f.qr, ladoQR, ladoQR);
  const qrFundo = extr(base, 0, eQ).subtract(extr(qr, eQ - inl, eQ + 1));
  const qrMod = extr(qr, eQ - inl, eQ);
  const icone = iconeNFC(L.lado, f.nfcTxt).intersect(retArred(L.lado - 1, L.lado - 1, 1));
  const espTag = Math.min(p.espTag, eQ - inl - 0.2);
  let nfcFundo = extr(base, 0, eQ).subtract(extr(icone, eQ - inl, eQ + 1));
  if (espTag > 0.05) nfcFundo = nfcFundo.subtract(MAN().cylinder(espTag + 0.01, p.diamTag / 2 + 0.2, p.diamTag / 2 + 0.2, 96).translate([0, 0, -0.01]));
  const nfcIco = extr(icone, eQ - inl, eQ);
  const suporte = extr(suporte2d(p.largSuporte, p.compSuporte), 0, p.espSuporte);

  // ----- montado (em pé, apoiado no suporte) -----
  const zQ = eP + eC;
  const emPlaca = [...corpo];
  if (separado) emPlaca.push(...gMont);
  emPlaca.push(['qrFundo', qrFundo.translate([L.qr.x, L.qr.y, zQ])], ['qr', qrMod.translate([L.qr.x, L.qr.y, zQ])]);
  emPlaca.push(['nfcFundo', nfcFundo.translate([L.nfc.x, L.nfc.y, zQ])], ['nfcIcone', nfcIco.translate([L.nfc.x, L.nfc.y, zQ])]);
  const pe = suporte.rotate([90, 0, 0]).translate([0, yCanal + p.espSuporte / 2, p.profCanal]);
  emPlaca.push(['suporte', pe]);
  const a = Math.atan2(p.compSuporte - p.profCanal, p.alturaCanal - p.espSuporte / 2) * 180 / Math.PI; // 90° - inclinação
  const rot = emPlaca.map(([id, m]) => [id, m.rotate([a, 0, 0])]);
  let zMin = Infinity; for (const [, m] of rot) zMin = Math.min(zMin, m.boundingBox().min[2]);
  const montado = rot.map(([id, m]) => [id, m.translate([0, 0, -zMin])]);

  // ----- pra imprimir -----
  const vira = m => m.rotate([180, 0, 0]).translate([0, 0, eQ]);
  const pecas = [...corpo.map(([id, m]) => [id, m, 'corpo'])];
  if (separado) pecas.push(...Object.entries(L.gPartes).map(([k, cs]) => [ids[k], extr(cs, 0, eF), 'g']));
  pecas.push(['qrFundo', vira(qrFundo), 'qr'], ['qr', vira(qrMod), 'qr'], ['nfcFundo', vira(nfcFundo), 'nfc'], ['nfcIcone', vira(nfcIco), 'nfc'], ['suporte', suporte, 'pe']);
  const imprimir = arrumarNaMesa(pecas, 6, p.mesa);

  return {
    montado, imprimir, L, inclinacao: 90 - a, ladoQR, modulo: ladoQR / (f.qrModulos || 1), espTag,
    total: eP + eF + Math.max(p.relevoTexto, p.relevoEstrelas),
  };
}

