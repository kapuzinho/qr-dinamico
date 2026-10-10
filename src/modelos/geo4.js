// Lote 4 (ideias inspiradas no MakerLab): lightbox em camadas, mapa das estrelas, cartão de música, polaroid,
// moldura de encaixe, bandeja bento, caixa dobrável, vaso, leque lithophane, flexi, quebra-cabeça de pixels,
// dado, clicker, keycap, enfeite giratório, quadro em relevo, foto em cores e QR artístico.
import { M } from '../core/motor.js';
import { caber, poli, malhaAlturas, extr, cent, retArred, baseApoio, formaDaArte, geoChaveiroArticulado } from './geo.js';
import { imagemParaSecao, qrMatriz } from '../core/formas.js';

const CS = () => M().CrossSection, MAN = () => M().Manifold;

// arruma peças soltas na mesa pra imprimir (deitadas, lado a lado)
// peças com o mesmo "grupo" (3º item) andam juntas — ex.: a placa e o texto embutido nela
export function arrumarNaMesa(pecas, gap = 6, largura = 230) {
  const grupos = [], porNome = new Map();
  pecas.forEach(([id, m, g], i) => {
    const k = g ?? `__${i}`;
    if (!porNome.has(k)) { porNome.set(k, []); grupos.push(porNome.get(k)); }
    porNome.get(k).push([id, m]);
  });
  let x = 0, y = 0, linha = 0; const out = [];
  for (const itens of grupos) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const [, m] of itens) { const b = m.boundingBox(); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], b.min[k]); mx[k] = Math.max(mx[k], b.max[k]); } }
    const w = mx[0] - mn[0], h = mx[1] - mn[1];
    if (x > 0 && x + w > largura) { x = 0; y += linha + gap; linha = 0; }
    for (const [id, m] of itens) out.push([id, m.translate([x - mn[0], -y - mx[1], -mn[2]])]);
    x += w + gap; linha = Math.max(linha, h);
  }
  return out;
}
// junta peças com o mesmo id (ex.: 30 blocos da mesma cor) numa só
export function agruparPorId(pecas) {
  const g = new Map();
  for (const [id, m] of pecas) { if (!g.has(id)) g.set(id, []); g.get(id).push(m); }
  return [...g].map(([id, l]) => [id, l.length === 1 ? l[0] : MAN().compose(l)]);
}

// ---------- foto de exemplo (pôr do sol com montanhas) pros modelos de foto ----------
export function fotoExemplo(W = 240, H = 180) {
  const d = new Uint8ClampedArray(W * H * 4);
  const monte = (x, f, a, b) => H * (b - a * Math.sin(x * f) * Math.sin(x * f * 0.37 + 1.3));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4, t = y / H;
    let v = 235 - 120 * t;                                                        // céu: claro em cima
    if (Math.hypot(x - W * 0.62, y - H * 0.42) < H * 0.16) v = 252;                // sol
    if (y > monte(x / W * 6.3, 1.0, 0.12, 0.62)) v = 150;                          // montanha do fundo
    if (y > monte(x / W * 6.3 + 2, 1.7, 0.1, 0.74)) v = 95;                        // montanha do meio
    if (y > monte(x / W * 6.3 + 4, 2.6, 0.06, 0.86)) v = 40;                       // primeiro plano
    d[o] = Math.min(255, v + 18); d[o + 1] = v; d[o + 2] = Math.max(0, v - 25); d[o + 3] = 255;
  }
  return { width: W, height: H, data: d, exemplo: true };
}
// aba lisa embaixo da placa: é ela que entra no rasgo da base (o conteúdo fica todo à vista)
const abaEncaixe = (placa, altBase) => {
  const b = placa.bounds(), prof = Math.max(altBase, 8) - 3 + 0.5;
  return CS().square([b.max[0] - b.min[0], prof + 1], false).translate([b.min[0], b.min[1] - prof]);
};
const luminancia = (img, u, v) => {   // u,v em 0..1
  const x = Math.min(img.width - 1, Math.max(0, Math.round(u * (img.width - 1)))), y = Math.min(img.height - 1, Math.max(0, Math.round(v * (img.height - 1))));
  const o = (y * img.width + x) * 4, d = img.data;
  return d[o + 3] < 10 ? 1 : (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
};
// recorte "cover" da foto pra uma proporção (sem distorcer): devolve função (u,v) -> luminância
// imagem inteira dentro da área (sobra preenchida com a cor do canto da imagem)
const recorteContain = (img, aspecto) => {
  const ia = img.width / img.height;
  const sw = ia > aspecto ? 1 : ia / aspecto, sh = ia > aspecto ? aspecto / ia : 1;
  const fundo = (luminancia(img, 0, 0) + luminancia(img, 1, 0) + luminancia(img, 0, 1) + luminancia(img, 1, 1)) / 4;
  return (u, v) => {
    const x = (u - (1 - sw) / 2) / sw, y = (v - (1 - sh) / 2) / sh;
    return x < 0 || x > 1 || y < 0 || y > 1 ? fundo : luminancia(img, x, y);
  };
};
const recorteCover = (img, aspecto) => {
  const ia = img.width / img.height;
  const cw = ia > aspecto ? aspecto / ia : 1, ch = ia > aspecto ? 1 : ia / aspecto;
  return (u, v) => luminancia(img, (1 - cw) / 2 + u * cw, (1 - ch) / 2 + v * ch);
};

// ---------- 1. Lightbox em camadas (cada camada pega um tom da foto) ----------
export function geoLightbox(img, p) {
  const C = CS(), Man = MAN();
  const W = p.largura, H = p.altura, mo = p.moldura, Wi = W - 2 * mo, Hi = H - 2 * mo, n = Math.round(p.camadas);
  const inner = C.square([Wi, Hi], true), ext = retArred(W, H, p.raio), anel = ext.subtract(inner);
  // a foto é recortada na proporção da janela e esticada pra cobrir toda a janela
  const recorte = recortarImagem(img, Wi / Hi);
  const camadas = [];
  for (let i = 0; i < n; i++) {
    // i = 0 é a de trás (pega quase tudo); a da frente pega só os tons mais escuros
    const lim = Math.round(p.limiarTras - (p.limiarTras - p.limiarFrente) * (n === 1 ? 0 : i / (n - 1)));
    let forma = null;
    try { forma = imagemParaSecao(recorte, { limiar: lim, largura: Wi * p.zoom, inverter: p.inverter }); } catch { forma = null; }
    if (forma) forma = cent(forma).translate([p.ajusteX, p.ajusteY]).intersect(inner.offset(0.4, 'Miter', 2));
    let placa = forma ? anel.add(forma) : anel;
    if (p.limpar > 0) placa = placa.offset(-p.limpar, 'Round', 2, 16).offset(p.limpar, 'Round', 2, 16).add(anel);   // tira farelinhos
    const peca = Man.union([extr(placa, 0, p.espCamada), extr(anel, p.espCamada, p.espCamada + p.espaco)]);
    camadas.push([`camada${i + 1}`, peca]);
  }
  // fundo: difusor fino + caixa pro LED, com rasgo pro cabo
  let fundo = Man.union([extr(ext, 0, p.difusor), extr(anel, p.difusor, p.difusor + p.fundoProf)]);
  fundo = fundo.subtract(Man.cube([p.furoCabo, mo * 2 + 2, p.fundoProf], true).translate([0, -H / 2, p.difusor + p.fundoProf / 2 + 0.6]));
  const todas = [['fundo', fundo], ...camadas];
  let z = 0; const montado = [];
  for (const [id, m] of todas) { const b = m.boundingBox(); montado.push([id, m.translate([0, 0, z])]); z += b.max[2] - b.min[2]; }
  return { montado, imprimir: arrumarNaMesa(todas, 6, p.mesa), profundidade: z };
}
// copia a foto já recortada na proporção (pra usar com imagemParaSecao)
export function recortarImagem(img, aspecto, maxLado = 500) {
  const ia = img.width / img.height;
  let cw = img.width, ch = img.height;
  if (ia > aspecto) cw = Math.round(img.height * aspecto); else ch = Math.round(img.width / aspecto);
  const ox = Math.floor((img.width - cw) / 2), oy = Math.floor((img.height - ch) / 2);
  const k = Math.min(1, maxLado / Math.max(cw, ch)), W = Math.max(2, Math.round(cw * k)), H = Math.max(2, Math.round(ch * k));
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = ox + Math.min(cw - 1, Math.floor(x / k)), sy = oy + Math.min(ch - 1, Math.floor(y / k)), s = (sy * img.width + sx) * 4, o = (y * W + x) * 4;
    d[o] = img.data[s]; d[o + 1] = img.data[s + 1]; d[o + 2] = img.data[s + 2]; d[o + 3] = img.data[s + 3];
  }
  return { width: W, height: H, data: d };
}

// ---------- 2. Mapa das estrelas ----------
// estrelas: { s: [[ra°, dec°, mag]], l: [[[ra°, dec°], ...]] }  → posições no disco (raio 1 = horizonte)
export function ceuEm(estrelas, { lat, lon, dataUTC }) {
  const jd = dataUTC.getTime() / 86400000 + 2440587.5, d = jd - 2451545.0;
  const gmst = ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360, lst = ((gmst + lon) % 360 + 360) % 360;
  const rad = Math.PI / 180, fi = lat * rad;
  const proj = (ra, dec) => {
    const ha = (lst - ra) * rad, de = dec * rad;
    const sAlt = Math.sin(fi) * Math.sin(de) + Math.cos(fi) * Math.cos(de) * Math.cos(ha);
    const alt = Math.asin(Math.max(-1, Math.min(1, sAlt)));
    if (alt < 0) return null;
    // azimute a partir do norte, crescendo pro leste
    const az = Math.atan2(-Math.cos(de) * Math.sin(ha), Math.sin(de) * Math.cos(fi) - Math.cos(de) * Math.sin(fi) * Math.cos(ha));
    const r = Math.cos(alt) / (1 + Math.sin(alt));          // estereográfica: horizonte em r = 1
    return [-r * Math.sin(az), r * Math.cos(az)];          // norte em cima, leste à esquerda (olhando pro céu)
  };
  const st = [];
  for (const [ra, dec, m] of estrelas.s) { const q = proj(ra, dec); if (q) st.push([q[0], q[1], m]); }
  const ln = [];
  for (const seg of estrelas.l) {
    let atual = [];
    for (const [ra, dec] of seg) { const q = proj(ra, dec); if (q) atual.push(q); else { if (atual.length > 1) ln.push(atual); atual = []; } }
    if (atual.length > 1) ln.push(atual);
  }
  return { estrelas: st, linhas: ln };
}
export function layoutMapaEstrelas(ceu, textos, p) {
  const C = CS(), R = p.diametro / 2, Rc = R - p.anelLargura;
  const disco = C.circle(Rc, 160);
  const pts = [];
  for (const [x, y, m] of ceu.estrelas) {
    if (m > p.magMax) continue;
    const t = Math.max(0, Math.min(1, (p.magMax - m) / (p.magMax + 1.5)));
    pts.push(C.circle(p.estrelaMin + (p.estrelaMax - p.estrelaMin) * Math.pow(t, 1.6), 12).translate([x * Rc, y * Rc]));
  }
  let detalhe = pts.length ? C.union(pts) : null;
  if (p.constelacoes) {
    const segs = [];
    for (const l of ceu.linhas) for (let i = 0; i + 1 < l.length; i++) {
      const a = [l[i][0] * Rc, l[i][1] * Rc], b = [l[i + 1][0] * Rc, l[i + 1][1] * Rc], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 0.3 || len > Rc) continue;
      const nx = -dy / len * p.linha / 2, ny = dx / len * p.linha / 2;
      segs.push(poli([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]));
    }
    if (segs.length) detalhe = detalhe ? detalhe.add(C.union(segs)) : C.union(segs);
  }
  if (detalhe) detalhe = detalhe.intersect(disco.offset(-0.3, 'Round', 2, 64));
  const anel = p.anelLargura > 0 ? C.circle(R, 160).subtract(C.circle(R - p.anelLargura * 0.6, 160)) : null;
  // textos embaixo do disco
  const linhas = textos.filter(Boolean);
  let y = -R - p.espacoTexto; const tx = [];
  linhas.forEach((t, i) => {
    const h = i === 0 ? p.alturaTitulo : p.alturaInfo;
    const tt = caber(t, p.diametro * 0.95, h), b = tt.bounds();
    tx.push(tt.translate([-(b.min[0] + b.max[0]) / 2, y - b.max[1]])); y -= (b.max[1] - b.min[1]) + p.espacoTexto * 0.6;
  });
  const texto = tx.length ? C.union(tx) : null;
  let placa;
  if (p.formato === 'disco' || !texto) placa = C.circle(R + p.margem, 160);
  else {
    const topo = R + p.margem, base = y - p.margem + p.espacoTexto * 0.6;
    placa = retArred(p.diametro + 2 * p.margem, topo - base, p.raioPlaca).translate([0, (topo + base) / 2]);
  }
  return { placa, detalhe, anel, texto: p.formato === 'disco' ? null : texto };
}
export function geoMapaEstrelas(L, p) {
  const e = p.espessura, pecas = [['placa', extr(L.placa, 0, e)]];
  if (L.detalhe) pecas.push(['estrelas', extr(L.detalhe, e, e + p.relevo)]);
  if (L.anel) pecas.push(['anel', extr(L.anel, e, e + p.relevo)]);
  if (L.texto) pecas.push(['texto', extr(L.texto, e, e + p.relevo)]);
  return pecas;
}

// ---------- 3. Cartão de música (foto em 2 tons + título + barra + botões) ----------
export function iconesPlayer(h) {
  const C = CS(), r = h / 2;
  const tri = (x, s, k = 1) => poli([[x, -r * 0.55 * k], [x + s * r * 0.9 * k, 0], [x, r * 0.55 * k]]);
  const play = C.circle(r, 48).subtract(tri(-r * 0.3, 1, 0.95));
  const ant = C.union([tri(r * 0.15, -1, 0.7), tri(r * 0.75, -1, 0.7), C.square([r * 0.14, r * 0.8], true).translate([-r * 0.65, 0])]);
  const prox = ant.mirror([1, 0]);
  const coracao = C.union([C.circle(r * 0.26, 24).translate([-r * 0.24, r * 0.12]), C.circle(r * 0.26, 24).translate([r * 0.24, r * 0.12]),
    poli([[-r * 0.48, r * 0.05], [r * 0.48, r * 0.05], [0, -r * 0.48]])]);
  const rep = C.circle(r * 0.42, 32).subtract(C.circle(r * 0.28, 32)).subtract(C.square([r * 0.3, r * 0.3], false).translate([0, 0])).add(tri(r * 0.08, 1, 0.4).translate([0, r * 0.35]));
  return { play, ant, prox, coracao, rep };
}
export function layoutCartaoMusica(fot, textos, p) {
  const C = CS(), W = p.largura, mg = p.margem, ladoFoto = W - 2 * mg;
  const area = C.square([ladoFoto, ladoFoto * p.alturaFoto], true);
  const yFoto = 0;
  let foto = null;
  if (fot) {
    try { foto = imagemParaSecao(recortarImagem(fot, 1 / p.alturaFoto), { limiar: p.limiar, largura: ladoFoto, inverter: p.inverter }); } catch { foto = null; }
    if (foto) foto = cent(foto).intersect(area);
  }
  const molduraFoto = retArred(ladoFoto + 1.6, ladoFoto * p.alturaFoto + 1.6, 3).subtract(area);
  let y = -ladoFoto * p.alturaFoto / 2 - p.espaco;
  const pedacos = [];
  const linha = (cs, h, alinhar = 'esq') => {
    if (!cs) return;
    const t = caber(cs, ladoFoto * (alinhar === 'esq' ? 0.82 : 1), h), b = t.bounds();
    pedacos.push(t.translate([-ladoFoto / 2 - b.min[0], y - b.max[1]])); y -= (b.max[1] - b.min[1]) + p.espaco * 0.55;
  };
  linha(textos.titulo, p.alturaTitulo); linha(textos.artista, p.alturaArtista);
  y -= p.espaco * 0.4;
  // barra de progresso
  const prog = Math.max(0.02, Math.min(0.98, p.progresso));
  const barra = C.square([ladoFoto, 1.2], false).translate([-ladoFoto / 2, y - 0.6]);
  const cheia = C.square([ladoFoto * prog, 1.2], false).translate([-ladoFoto / 2, y - 0.6]).add(C.circle(2, 24).translate([-ladoFoto / 2 + ladoFoto * prog, y]));
  y -= 4;
  if (textos.tempos) {
    const [t1, t2] = textos.tempos;
    const a = caber(t1, ladoFoto * 0.25, p.alturaArtista * 0.75), b1 = a.bounds(); pedacos.push(a.translate([-ladoFoto / 2 - b1.min[0], y - b1.max[1]]));
    const b = caber(t2, ladoFoto * 0.25, p.alturaArtista * 0.75), b2 = b.bounds(); pedacos.push(b.translate([ladoFoto / 2 - b2.max[0], y - b2.max[1]]));
    y -= p.alturaArtista * 0.75 + p.espaco * 0.6;
  }
  const hb = p.alturaBotoes, ic = iconesPlayer(hb), yb = y - hb / 2 - 1;
  const passo = ladoFoto / 4;
  const botoes = C.union([ic.coracao.translate([-2 * passo + hb * 0.4, yb]), ic.ant.translate([-passo, yb]), ic.play.translate([0, yb]), ic.prox.translate([passo, yb]), ic.rep.translate([2 * passo - hb * 0.4, yb])]);
  y = yb - hb / 2 - mg;
  const topo = ladoFoto * p.alturaFoto / 2 + mg;
  const placa = retArred(W, topo - y, p.raio).translate([0, (topo + y) / 2]);
  const detalhe = C.union([...(foto ? [foto] : []), molduraFoto, ...pedacos, barra.subtract(cheia), cheia, botoes]);
  const bb = placa.bounds();
  return { placa, detalhe, cheia, larg: bb.max[0] - bb.min[0], alt: bb.max[1] - bb.min[1] };
}
export function geoCartaoMusica(L, p) {
  const e = p.espessura, pecas = [['cartao', extr(L.placa, 0, e)], ['detalhe', extr(L.detalhe, e, e + p.relevo)]];
  if (!p.base) return { montado: pecas, imprimir: pecas };
  const B = baseApoio(L.larg, e + p.relevo, { folgaBase: p.folgaBase, profBase: p.profBase, altBase: p.altBase });
  pecas[0][1] = extr(L.placa.add(abaEncaixe(L.placa, p.altBase)), 0, e);
  const bb = pecas[0][1].boundingBox();
  const emPe = m => m.translate([0, -bb.min[1], -(e + p.relevo) / 2]).rotate([90, 0, 0]).translate([0, 0, 3]);
  const dx = L.larg / 2 + B.baseL / 2 + 8;
  return { montado: [...pecas.map(([id, m]) => [id, emPe(m)]), ['base', B.base.translate([-dx, 0, 0])]], imprimir: arrumarNaMesa([...pecas.map(([id, m]) => [id, m, 'cartao']), ['base', B.base]]) };
}

// ---------- 4. Porta-retrato Polaroid (moldura + tampa de trás com rebaixo pra foto e ímãs) ----------
export const TAMANHOS_FOTO = {
  instaxMini: { nome: 'Instax Mini (54 × 86)', foto: [54, 86], janela: [46, 62], baixo: 17 },
  instaxSquare: { nome: 'Instax Square (72 × 86)', foto: [72, 86], janela: [62, 62], baixo: 17 },
  instaxWide: { nome: 'Instax Wide (108 × 86)', foto: [108, 86], janela: [99, 62], baixo: 17 },
  foto10x15: { nome: 'Foto 10 × 15', foto: [100, 150], janela: [94, 144], baixo: 3 },
  foto9x13: { nome: 'Foto 9 × 13', foto: [89, 127], janela: [83, 121], baixo: 3 },
};
export function geoPolaroid(legenda, p) {
  const C = CS(), Man = MAN();
  const t = TAMANHOS_FOTO[p.tamanho], [fw, fh] = t.foto, [jw, jh] = t.janela;
  const lado = p.borda, baixo = p.bordaBaixo, folgaPino = 4.5;
  // a moldura precisa ser maior que a foto inteira (o cartão fica atrás) e ter espaço pros pinos dos lados
  const W = Math.max(jw + 2 * lado, fw + 1 + 2 * folgaPino * 1.6), H = Math.max(jh + lado + baixo, fh + 4);
  const yJan = H / 2 - lado - jh / 2;                                   // janela em cima, borda grande embaixo
  const ext = retArred(W, H, p.raio), jan = retArred(jw, jh, 1).translate([0, yJan]);
  const rebaixo = p.espFoto + 0.2, eF = p.espFrente;
  const eT = Math.max(p.espTras, rebaixo + (p.imas > 0 ? p.espIma + 0.2 + 0.6 : 0.8));
  // 4 pinos (tampa) e furos (moldura) dos lados, fora do bolso da foto
  const px = (fw + 1) / 2 + (W - (fw + 1)) / 4, rPino = Math.min(1.4, (W - fw - 1) / 8);
  const pts = [[px, H * 0.3], [-px, H * 0.3], [px, -H * 0.3], [-px, -H * 0.3]];
  let moldura = extr(ext.subtract(jan), 0, eF);
  for (const [x, y] of pts) moldura = moldura.subtract(Man.cylinder(eF - 0.8, rPino + p.folga, rPino + p.folga, 24).translate([x, y, -0.01]));
  const pecas = [['moldura', moldura]];
  if (legenda) {
    const zona = C.square([W - 2 * lado, baixo - 4], true).translate([0, -H / 2 + baixo / 2]);
    const tt = cent(caber(legenda, W - 2 * lado - 4, Math.min(p.alturaLegenda, baixo - 4))).translate([0, -H / 2 + baixo / 2]).intersect(zona);
    pecas.push(['legenda', extr(tt, eF, eF + p.relevo)]);
  }
  // tampa de trás: placa + rebaixo pra foto (aberto em cima pra deslizar a foto) + pinos + furos de ímã por baixo
  const bolso = C.square([fw + 1, fh + 1], true);
  let tampa = extr(ext, 0, eT).subtract(extr(bolso.add(C.square([fw - 6, lado + 2], true).translate([0, H / 2])), eT - rebaixo, eT + 0.01));
  for (const [x, y] of pts) tampa = tampa.add(Man.cylinder(eF - 1.2 + rebaixo * 0, rPino, rPino, 24).translate([x, y, eT - 0.01]));
  if (p.imas > 0) for (const s of [-1, 1]) tampa = tampa.subtract(Man.cylinder(p.espIma + 0.2, p.diamIma / 2 + 0.15, p.diamIma / 2 + 0.15, 48).translate([s * W * 0.25, 0, -0.01]));
  const montado = [['tampa', tampa], ...pecas.map(([id, m]) => [id, m.translate([0, 0, eT])])];
  return { montado, imprimir: arrumarNaMesa([['tampa', tampa], ...pecas.map(([id, m]) => [id, m, 'frente'])]), W, H, bolso: [fw + 1, fh + 1], espTampa: eT };
}

// ---------- 5. Moldura de encaixe (4 barras com rabo-de-andorinha) ----------
export function geoMolduraEncaixe(nome, p) {
  const C = CS();
  const PW = p.larguraFoto, PH = p.alturaFoto, b = p.largura, e = p.espessura, f = p.folga;
  const vis = 2.5;                                           // a foto passa 2,5 mm por trás da borda (aba)
  const Wv = PW - 2 * vis, Hv = PH - 2 * vis;                // abertura visível
  const W = Wv + 2 * b, H = Hv + 2 * b;
  const rabo = (x, y, sentido, k = 0) => {                   // trapézio: estreito na base, largo na ponta
    const L = b * 0.55, a = b * 0.28 + k, c = b * 0.42 + k;
    return poli([[x - a / 2, y - k * sentido], [x + a / 2, y - k * sentido], [x + c / 2, y + sentido * (L + k)], [x - c / 2, y + sentido * (L + k)]]);
  };
  // rebaixo da foto: na face de trás (z de 0 a p.rebaixo), por dentro da abertura + vis
  const furoFoto = C.square([PW + 2 * f, PH + 2 * f], true);
  const barraH = y0 => {   // barra de cima/baixo: largura inteira, com 2 encaixes fêmea
    let r = C.square([W, b], false).translate([-W / 2, y0]);
    const s = y0 > 0 ? 1 : -1, yb = y0 > 0 ? y0 : y0 + b;
    for (const sx of [-1, 1]) r = r.subtract(rabo(sx * (W / 2 - b / 2), yb, s, f));
    return r;
  };
  const barraV = x0 => {   // laterais: entre as barras, com 2 encaixes macho
    let r = C.square([b, Hv], false).translate([x0, -Hv / 2]);
    const xc = x0 + b / 2;
    r = r.add(rabo(xc, Hv / 2, 1)).add(rabo(xc, -Hv / 2, -1));
    return r;
  };
  const corte = m2 => extr(m2.intersect(furoFoto), -0.01, p.rebaixo);
  const fazer = cs => extr(cs, 0, e).subtract(corte(cs));
  const pecas = [['cima', fazer(barraH(Hv / 2))], ['baixo', fazer(barraH(-Hv / 2 - b))], ['esquerda', fazer(barraV(-W / 2))], ['direita', fazer(barraV(W / 2 - b))]];
  if (nome) {
    const t = cent(caber(nome, Wv * 0.8, b * 0.62)).translate([0, -Hv / 2 - b / 2]);
    pecas.push(['nome', extr(t, e, e + p.relevo)]);
  }
  // as laterais ficam com a cor das barras
  return { montado: pecas, imprimir: arrumarNaMesa(pecas.map(([id, m]) => [id === 'nome' ? 'nome' : 'moldura', m, id === 'nome' || id === 'baixo' ? 'baixo' : id])), W, H };
}

// ---------- 6. Bandeja bento (grade de letras: mesma letra = mesma cavidade) ----------
export function geoBento(p) {
  const C = CS();
  const linhas = p.layout.split(/[\/\n]/).map(l => l.replace(/\s/g, '')).filter(Boolean);
  if (!linhas.length) throw new Error('Desenhe a grade (ex.: AAB/CCB).');
  const nl = linhas.length, nc = Math.max(...linhas.map(l => l.length));
  const W = p.largura, D = p.profundidade, H = p.altura, pa = p.parede;
  const cw = (W - pa) / nc, ch = (D - pa) / nl;
  const grupos = new Map();
  linhas.forEach((l, j) => [...l.padEnd(nc, '.')].forEach((k, i) => {
    if (k === '.' || k === '-') return;
    const r = C.square([cw + 0.02, ch + 0.02], false).translate([-W / 2 + pa / 2 + i * cw - 0.01, D / 2 - pa / 2 - (j + 1) * ch - 0.01]);
    grupos.set(k, grupos.has(k) ? grupos.get(k).add(r) : r);
  }));
  let bandeja = extr(retArred(W, D, p.raio), 0, H);
  const rI = Math.max(0.5, p.raioCelula), cels = [];
  for (const g of grupos.values()) {
    const cel = g.offset(-pa / 2, 'Miter', 2).offset(-rI, 'Round', 2, 24).offset(rI, 'Round', 2, 24);
    if (!cel.isEmpty()) { bandeja = bandeja.subtract(extr(cel, p.fundo, H + 1)); cels.push(cel); }
  }
  return { partes: [['bandeja', bandeja]], celulas: cels, grade: [nc, nl] };
}

// ---------- 7. Caixa dobrável (sai chapada, dobra nos vincos) + tampa ----------
export function geoCaixaDobravel(marca, p) {
  const C = CS(), Man = MAN();
  const L = p.largura, Wd = p.profundidade, H = p.altura, t = p.espessura, aba = Math.min(p.aba, H * 0.9), v = p.vinco;
  const pedacos = [C.square([L, Wd], true)];
  // paredes (frente/trás ao longo de X, laterais ao longo de Y)
  pedacos.push(C.square([L, H], false).translate([-L / 2, Wd / 2]), C.square([L, H], false).translate([-L / 2, -Wd / 2 - H]));
  pedacos.push(C.square([H, Wd], false).translate([L / 2, -Wd / 2]), C.square([H, Wd], false).translate([-L / 2 - H, -Wd / 2]));
  // abas nas paredes da frente/trás (dobram pra dentro e encostam nas laterais)
  for (const s of [1, -1]) for (const sx of [1, -1]) {
    const y0 = s > 0 ? Wd / 2 : -Wd / 2 - H;
    pedacos.push(poli([[sx * L / 2, y0 + 0.6], [sx * (L / 2 + aba), y0 + 2.5], [sx * (L / 2 + aba), y0 + H - 2.5], [sx * L / 2, y0 + H - 0.6]]));
  }
  let rede = C.union(pedacos);
  let caixa = extr(rede, 0, t);
  // vincos em V (90°) na face de cima: a parede dobra pra cima e o V fecha
  const prof = t - v, abre = 2 * prof;
  const vinco = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
    // perfil em V: largura em x, profundidade em y (vira -z), comprido ao longo de +y depois de girar
    const tri = poli([[-abre / 2, -0.02], [abre / 2, -0.02], [0, prof]]);
    return tri.extrude(len + 0.02).rotate([-90, 0, 0]).rotate([0, 0, ang - 90]).translate([x0, y0, t]);
  };
  const linhas = [[-L / 2, Wd / 2, L / 2, Wd / 2], [-L / 2, -Wd / 2, L / 2, -Wd / 2], [L / 2, -Wd / 2, L / 2, Wd / 2], [-L / 2, -Wd / 2, -L / 2, Wd / 2],
    [L / 2, Wd / 2, L / 2, Wd / 2 + H], [-L / 2, Wd / 2, -L / 2, Wd / 2 + H], [L / 2, -Wd / 2 - H, L / 2, -Wd / 2], [-L / 2, -Wd / 2 - H, -L / 2, -Wd / 2]];
  for (const l of linhas) caixa = caixa.subtract(vinco(...l));
  const pecas = [];
  if (marca) {
    // marca na face de fora da parede da frente (que fica na mesa): embutida e espelhada
    const m = cent(caber(marca, L * 0.7, H * 0.6)).mirror([1, 0]).translate([0, -Wd / 2 - H / 2]);
    caixa = caixa.subtract(extr(m, -0.01, 0.6));
    pecas.push(['marca', extr(m, 0, 0.6)]);
  }
  pecas.unshift(['caixa', caixa]);
  for (const pc of pecas) if (pc[0] === 'marca' || pc[0] === 'caixa') pc[2] = 'caixa';
  // tampa: placa + saia por dentro
  const fT = p.folgaTampa, tampaExt = retArred(L + 2 * t + 2 * fT + 2 * 1.6, Wd + 2 * t + 2 * fT + 2 * 1.6, 2);
  const tampa = extr(tampaExt, 0, 1.6).add(extr(tampaExt.subtract(tampaExt.offset(-1.6)), 1.6, 1.6 + p.saiaTampa));
  pecas.push(['tampa', tampa]);
  return { imprimir: arrumarNaMesa(pecas, 8, p.mesa), montado: arrumarNaMesa(pecas, 8, p.mesa), rede };
}

// ---------- 8. Vaso paramétrico ----------
export function perfilVaso(p, recuo = 0) {
  const n = Math.round(p.lobos), R = p.diametro / 2, pts = [];
  for (let i = 0; i < 360; i++) {
    const a = i * Math.PI / 180;
    let r = R * (1 + p.ondulacao * Math.cos(n * a)) / (1 + p.ondulacao);
    if (p.estilo === 'estrela') r = R * (1 - p.ondulacao * (1 - Math.abs(Math.cos(n * a / 2))));
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const c = poli(pts);
  return recuo ? c.offset(-recuo, 'Round', 2, 32) : c;
}
export function geoVaso(p) {
  const H = p.altura, div = Math.max(8, Math.round(H / 1.2));
  const forma = (cs, h, z0) => {
    let m = cs.extrude(h, div, p.torcao * h / H, [p.topo, p.topo]).translate([0, 0, z0]);
    return m.warp(v => { const t = v[2] / H, k = 1 + p.bojo * Math.sin(Math.PI * Math.min(1, Math.max(0, t))); v[0] *= k; v[1] *= k; });
  };
  let vaso = forma(perfilVaso(p), H, 0);
  if (!p.modoVaso) {
    // oco com parede constante (mesma torção/escala do lado de fora)
    const dentro = perfilVaso(p, p.parede).extrude(H, div, p.torcao, [p.topo, p.topo])
      .warp(v => { const t = v[2] / H, k = 1 + p.bojo * Math.sin(Math.PI * t); v[0] *= k; v[1] *= k; })
      .translate([0, 0, p.fundo]);
    vaso = vaso.subtract(dentro);
  }
  return { partes: [['vaso', vaso]] };
}

// ---------- 9. Leque lithophane (lâminas que abrem e formam a foto) ----------
export function geoLeque(img, p) {
  const C = CS(), Man = MAN();
  const n = Math.round(p.laminas), A = p.abertura * Math.PI / 180, R = p.raio, r0 = p.raioFoto, rp = p.pino / 2;
  const passo = A / n, w = passo + p.sobreposicao * Math.PI / 180;      // cada lâmina cobre um pouco da vizinha
  const H = R - r0, rm = (R + r0) / 2, Wg = w * rm;
  const res = p.resolucao, cols = Math.max(4, Math.round(Wg / res) + 1), rows = Math.max(4, Math.round(H / res) + 1);
  const lum = recorteCover(img, (A * rm) / H);
  const laminas = [];
  for (let k = 0; k < n; k++) {
    const thk = -A / 2 + (k + 0.5) * passo;                                // ângulo do meio da lâmina (0 = em pé)
    const borda = 1.2;
    let foto = malhaAlturas(Wg, H, cols, rows, (i, j) => {
      const x = -Wg / 2 + Wg * i / (cols - 1), y = H / 2 - H * j / (rows - 1), r = rm + y, th = thk + x / rm;
      if (r > R - borda || Math.abs(x) > Wg / 2 - 0.8) return p.espMax;   // contorno mais grosso (resistência)
      let l = lum((th + A / 2) / A, (R - r) / H);
      if (p.inverter) l = 1 - l;
      return p.espMin + (p.espMax - p.espMin) * Math.pow(1 - l, p.contraste);
    });
    // malha plana -> setor (x vira ângulo, y vira raio), com a lâmina centrada em pé
    foto = foto.warp(v => { const r = rm + v[1], th = v[0] / rm; v[0] = r * Math.sin(th); v[1] = r * Math.cos(th); });
    // haste até o pino
    const larg = Math.max(4, rp * 2 + 3);
    let haste = C.square([larg, r0 + 1.5], false).translate([-larg / 2, 0]).add(C.circle(larg / 2 + 0.6, 48));
    haste = haste.subtract(C.circle(rp + p.folgaPino, 48));
    const lamina = Man.union([foto, extr(haste, 0, p.espHaste)]);
    laminas.push({ k, thk, m: lamina });
  }
  // pino com cabeça + arruela de pressão
  const alturaPilha = n * (p.espHaste + 0.2);
  const pino = Man.union([Man.cylinder(1.2, rp + 2, rp + 2, 48), Man.cylinder(alturaPilha + 2.2, rp, rp, 48).translate([0, 0, 1.19])]);
  const arruela = extr(C.circle(rp + 2, 48).subtract(C.circle(rp - 0.08, 48)), 0, 1.4);
  const montado = laminas.map(l => [`lamina${(l.k % 2) + 1}`, l.m.rotate([0, 0, -l.thk * 180 / Math.PI]).translate([0, 0, l.k * (p.espHaste + 0.2)])]);
  montado.push(['pino', pino.translate([0, 0, -1.2])]);
  const imprimir = arrumarNaMesa([...laminas.map(l => [`lamina${(l.k % 2) + 1}`, l.m]), ['pino', pino], ['pino', arruela]], 4, p.mesa);
  return { montado: agruparPorId(montado), imprimir: agruparPorId(imprimir), n };
}

// ---------- 10. Flexi (arte cortada em fatias com dobradiças impressas no lugar) ----------
export function geoFlexi(arte, p) {
  const C = CS();
  const F = formaDaArte(arte, { tamanho: p.tamanho, rotArte: 0, borda: 0.01, fecho: 0 });
  const a = F.arte, b = a.bounds(), n = Math.max(2, Math.round(p.fatias));
  const passo = (b.max[0] - b.min[0]) / n, fatias = [];
  for (let i = 0; i < n; i++) {
    const s = a.intersect(C.square([passo, 1e4], false).translate([b.min[0] + i * passo, -5e3]));
    if (!s.isEmpty() && s.area() > 1) fatias.push(s);
  }
  if (fatias.length < 2) throw new Error('A arte ficou pequena demais pra fatiar. Aumente o tamanho ou diminua as fatias.');
  // argola na altura do ponto mais à esquerda da primeira fatia (senão ela pode ficar solta no ar)
  const f0 = fatias[0], b0 = f0.bounds();
  let yEsq = 0, xMin = Infinity;
  for (const [x, y] of f0.toPolygons().flat()) if (x < xMin) { xMin = x; yEsq = y; }
  const argolaY = yEsq - (b0.min[1] + b0.max[1]) / 2;
  return geoChaveiroArticulado(fatias, { ...p, espaco: 0.6, larguraEspaco: 0, engrossar: 0, juntaY: 0, argolaY, semArgola: !p.argola });
}

// ---------- 11. Quebra-cabeça de pixels (bandeja com casas + pecinhas por cor) ----------
export function quantizar(img, nCores, cols) {
  const rows = Math.max(1, Math.round(cols * img.height / img.width));
  const px = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let r = 0, g = 0, b = 0, n = 0;
    const x0 = Math.floor(i * img.width / cols), x1 = Math.max(x0 + 1, Math.floor((i + 1) * img.width / cols));
    const y0 = Math.floor(j * img.height / rows), y1 = Math.max(y0 + 1, Math.floor((j + 1) * img.height / rows));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * img.width + x) * 4; r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; n++; }
    px.push([r / n, g / n, b / n]);
  }
  // k-médias simples (começa do escuro pro claro)
  const ord = px.map((c, i) => [c[0] + c[1] + c[2], i]).sort((a, b) => a[0] - b[0]);
  let cen = []; for (let k = 0; k < nCores; k++) cen.push(px[ord[Math.floor((k + 0.5) * ord.length / nCores)][1]].slice());
  const lab = new Array(px.length).fill(0);
  for (let it = 0; it < 15; it++) {
    px.forEach((c, i) => { let m = 0, dm = Infinity; cen.forEach((q, k) => { const d = (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2 + (c[2] - q[2]) ** 2; if (d < dm) { dm = d; m = k; } }); lab[i] = m; });
    cen = cen.map((q, k) => { const s = [0, 0, 0]; let n = 0; px.forEach((c, i) => { if (lab[i] === k) { s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; n++; } }); return n ? s.map(v => v / n) : q; });
  }
  // reordena do mais escuro pro mais claro
  const ordem = cen.map((c, k) => [c[0] + c[1] + c[2], k]).sort((a, b) => a[0] - b[0]).map(x => x[1]), novo = new Map(ordem.map((k, i) => [k, i]));
  return { cols, rows, lab: lab.map(k => novo.get(k)), cores: ordem.map(k => cen[k]).map(c => (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2])) };
}
export function geoPixelPuzzle(q, p) {
  const Man = MAN(), C = CS(), s = p.pixel, f = p.folga, cols = q.cols, rows = q.rows;
  const W = cols * s, H = rows * s, borda = p.borda;
  // bandeja: piso + casas quadradas (paredinhas entre as casas)
  const casas = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++)
    casas.push(Man.cube([s - p.parede, s - p.parede, p.profundidade + 1]).translate([-W / 2 + i * s + p.parede / 2, H / 2 - (j + 1) * s + p.parede / 2, p.piso]));
  const bandeja = extr(retArred(W + 2 * borda, H + 2 * borda, 3), 0, p.piso + p.profundidade).subtract(Man.compose(casas));
  // pecinhas: cada cor numa peça, arrumadas em grade
  const lado = s - p.parede - 2 * f, pecas = [['bandeja', bandeja]], contagem = [];
  q.cores.forEach((_, k) => {
    const n = q.lab.filter(x => x === k).length; contagem.push(n);
    if (!n) return;
    const porLinha = Math.max(1, Math.floor(p.mesa / (lado + 1.5))), cubos = [];
    for (let i = 0; i < n; i++) cubos.push(Man.cube([lado, lado, p.altPeca]).translate([(i % porLinha) * (lado + 1.5), -Math.floor(i / porLinha) * (lado + 1.5), 0]));
    pecas.push([`cor${k + 1}`, Man.compose(cubos)]);
  });
  // montado: pecinhas encaixadas na bandeja, na cor do padrão
  const porCor = q.cores.map(() => []);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++)
    porCor[q.lab[j * cols + i]].push(Man.cube([lado, lado, p.altPeca]).translate([-W / 2 + i * s + p.parede / 2 + f, H / 2 - (j + 1) * s + p.parede / 2 + f, p.piso]));
  const montado = [['bandeja', bandeja], ...porCor.map((l, k) => [`cor${k + 1}`, l.length ? Man.compose(l) : null]).filter(x => x[1])];
  return { montado, imprimir: arrumarNaMesa(pecas, 8, p.mesa), contagem, W, H };
}

// ---------- 12. Dado personalizado ----------
export function pips(n) {
  const C = CS();
  const pos = { 1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]], 4: [[-1, 1], [1, 1], [-1, -1], [1, -1]], 5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]], 6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]] }[n];
  return C.union(pos.map(([x, y]) => C.circle(0.12, 32).translate([x * 0.33, y * 0.33])));   // ocupa ~0,9 unidade de lado
}
// faces: [cs|null] na ordem 1..6 (já centradas, no tamanho final)
export function geoDado(faces, p) {
  const Man = MAN(), L = p.lado, q = retArred(L, L, p.raio);
  const cubo = extr(q, -L / 2, L / 2).intersect(extr(q, -L / 2, L / 2).rotate([90, 0, 0])).intersect(extr(q, -L / 2, L / 2).rotate([0, 90, 0])).translate([0, 0, L / 2]);
  // opostos somam 7: 1↔6 (cima/baixo), 2↔5, 3↔4
  const onde = { 1: [0, 0, 0], 6: [180, 0, 0], 2: [-90, 0, 0], 5: [90, 0, 0], 3: [0, 90, 0], 4: [0, -90, 0] };
  const marcas = [];
  faces.forEach((cs, i) => {
    if (!cs || cs.isEmpty()) return;
    marcas.push(extr(cs, L / 2 - p.profundidade, L / 2 + 0.05).rotate(onde[i + 1]).translate([0, 0, L / 2]));
  });
  if (!marcas.length) return { partes: [['dado', cubo]] };
  const u = Man.union(marcas);
  return { partes: [['dado', cubo.subtract(u)], ['marcas', u.intersect(cubo)]] };
}

// ---------- 13. Clicker (botão de teclado mecânico num chaveiro com a arte) ----------
export function geoClicker(arte, p) {
  const C = CS(), Man = MAN();
  const F = formaDaArte(arte, { tamanho: p.tamanho, rotArte: 0, borda: p.borda, fecho: 2 });
  const forma = F.base, art = F.arte;
  const livre = C.square([14 + 2 * p.parede + 1.2, 14 + 2 * p.parede + 1.2], true);
  if (forma.offset(-0.3).intersect(livre).area() < livre.area() * 0.97) throw new Error('A arte é pequena pro botão: precisa de uns 20 mm livres no meio. Aumente o tamanho da arte.');
  const h = p.altura, placa = 1.5;
  let corpo = extr(forma, 0, h)
    .subtract(extr(C.square([15.6, 15.6], true), p.fundo, h - placa))          // espaço do corpo do switch
    .subtract(extr(C.square([14, 14], true), h - placa - 0.01, h + 0.01));      // furo da placa (o switch trava aqui)
  if (p.argola) {
    const bb = forma.bounds(), rA = p.furo / 2 + 2.2, xa = bb.max[0] + rA - 2.5;
    corpo = corpo.add(extr(C.circle(rA, 48).translate([xa, 0]).add(C.square([5, rA * 1.4], true).translate([xa - rA, 0])).subtract(C.circle(p.furo / 2, 48).translate([xa, 0])), 0, Math.min(4, h)));
    corpo = corpo.subtract(extr(C.circle(p.furo / 2, 48).translate([xa, 0]), -1, h + 1));
  }
  const detalhe = art.subtract(C.square([17, 17], true)).intersect(forma.offset(-0.8, 'Round', 2, 32));
  const partes = [['corpo', corpo]];
  if (!detalhe.isEmpty()) partes.push(['arte', extr(detalhe, h, h + p.relevo)]);
  return { partes };
}

// ---------- 14. Keycap (encaixe Cherry MX) ----------
export function geoKeycap(legenda, p) {
  const Man = MAN(), C = CS(), u = p.largura * 18.0 - 0.9, uy = 18.0 - 0.9;
  const base = retArred(u, uy, 1.2), topoC = retArred(u - 2 * p.afinar, uy - 2 * p.afinar, 2);
  const lam = (cs, z) => extr(cs, z, z + 0.01);
  const casca = Man.hull([lam(base, 0), lam(topoC, p.altura - 0.01)]);
  const oco = Man.hull([lam(base.offset(-p.parede), -0.01), lam(topoC.offset(-p.parede), p.altura - p.parede - 0.01)]);
  let cap = casca.subtract(oco);
  const cruz = C.square([4.1 + p.folga, 1.17 + p.folga], true).add(C.square([1.17 + p.folga, 4.1 + p.folga], true));
  cap = cap.add(extr(C.circle(2.8, 48), 0, p.altura - p.parede + 0.01).subtract(extr(cruz, -0.01, 4)));
  const partes = [];
  if (legenda) {
    const t = cent(caber(legenda, (u - 2 * p.afinar) * 0.66, (uy - 2 * p.afinar) * 0.66));
    if (p.modo === 'gravada') { cap = cap.subtract(extr(t, p.altura - 0.6, p.altura + 0.1)); partes.push(['legenda', extr(t, p.altura - 0.6, p.altura)]); }
    else partes.push(['legenda', extr(t, p.altura, p.altura + 0.6)]);
  }
  return { partes: [['keycap', cap], ...partes] };
}

// ---------- 15. Enfeite giratório (disco que gira no aro, impresso no lugar) ----------
export function geoEnfeite(frente, verso, p) {
  const Man = MAN(), C = CS(), R = p.diametro / 2, a = p.aro, g = p.folga, e = p.espessura, zc = e / 2, rp = p.pino / 2, c = p.folgaPino;
  const Rd = R - a - g;
  let aro = extr(C.circle(R, 128).subtract(C.circle(R - a, 128)), 0, e);
  const yArg = R + 3.2;
  aro = aro.add(extr(C.circle(4.6, 40).translate([0, yArg]).add(C.square([6, 4], true).translate([0, R + 0.6])).subtract(C.circle(2.2, 32).translate([0, yArg])), 0, e));
  aro = aro.subtract(extr(C.circle(2.2, 32).translate([0, yArg]), -1, e + 1));
  let disco = extr(C.circle(Rd, 128), 0, e);
  const cilY = (y0, y1, r) => Man.cylinder(y1 - y0, r, r, 32).rotate([-90, 0, 0]).translate([0, y0, zc]);
  const entra = a * 0.6;
  disco = disco.add(cilY(Rd - 1, Rd + g + entra, rp)).add(cilY(-Rd - g - entra, -Rd + 1, rp));
  aro = aro.subtract(cilY(Rd - 0.01, Rd + g + entra + 0.5, rp + c)).subtract(cilY(-Rd - g - entra - 0.5, -Rd + 0.01, rp + c));
  const pecas = [['aro', aro], ['disco', disco]];
  const lim = C.circle(Rd - 1.2, 96), lado = Rd * 1.45;
  if (frente) pecas.push(['frente', extr(cent(caber(frente, lado, lado)).intersect(lim), e, e + p.relevo)]);
  if (verso) {
    const t = cent(caber(verso, lado, lado)).mirror([1, 0]).intersect(lim);
    pecas[1][1] = pecas[1][1].subtract(extr(t, -0.01, 0.6));
    pecas.push(['verso', extr(t, 0, 0.6)]);
  }
  return { partes: pecas };
}

// ---------- 16. Quadro em relevo (foto vira relevo de altura: claro = alto) ----------
export function geoRelevoFoto(img, p) {
  const C = CS(), Man = MAN();
  const W = p.largura, H = p.altura, mo = p.moldura, Wi = W - 2 * mo, Hi = H - 2 * mo;
  const lum = (p.encaixe === 'preencher' ? recorteCover : recorteContain)(img, Wi / Hi), cols = Math.max(4, Math.round(Wi / p.resolucao) + 1), rows = Math.max(4, Math.round(Hi / p.resolucao) + 1);
  const relevo = malhaAlturas(Wi + 0.02, Hi + 0.02, cols, rows, (i, j) => {
    let l = lum(i / (cols - 1), j / (rows - 1));
    if (p.inverter) l = 1 - l;
    return p.espBase + p.relevo * Math.pow(l, p.contraste);
  });
  let quadro = Man.union([relevo, extr(retArred(W, H, p.raio).subtract(C.square([Wi, Hi], true)), 0, p.espBase + p.relevo + p.altMoldura)]);
  if (p.formato === 'oval') {
    const oval = C.circle(0.5, 128).scale([W, H]);
    quadro = Man.union([relevo.intersect(extr(oval.offset(-mo), -1, 100)), extr(oval.subtract(oval.offset(-mo)), 0, p.espBase + p.relevo + p.altMoldura)]);
  }
  if (p.pendurar) quadro = quadro.subtract(extr(C.circle(4, 32).translate([0, H / 2 - mo - 8]).add(C.square([3.4, 8], true).translate([0, H / 2 - mo - 12])), -0.01, Math.min(2.5, p.espBase - 0.6)));
  return { partes: [['quadro', quadro]] };
}

// ---------- 17. Foto em cores (mosaico de até 4 cores, cada uma uma peça) ----------
export function geoFotoCores(img, p) {
  const C = CS();
  const asp = p.altura / p.largura, rec = recortarImagem(img, 1 / asp, 360);
  const q = quantizar(rec, p.cores, Math.round(Math.min(360, p.largura / p.detalhe)));
  const W = p.largura, H = W * q.rows / q.cols;
  const area = C.square([W, H], true);
  const regioes = [];
  for (let k = 1; k < q.cores.length; k++) {
    // máscara da cor k (preto = cor k) e contorno vetorizado
    const d = new Uint8ClampedArray(q.cols * q.rows * 4);
    for (let i = 0; i < q.lab.length; i++) { const v = q.lab[i] === k ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    const cs = imagemParaSecaoAlinhada({ width: q.cols, height: q.rows, data: d }, W, H, W / q.cols);
    if (cs) regioes.push([k, cs.intersect(area)]);
  }
  const pecas = [['cor1', extr(retArred(W + 2 * p.moldura, H + 2 * p.moldura, p.raio), 0, p.espBase)]];
  let ocupado = null;
  for (const [k, cs] of regioes.reverse()) {    // as mais claras primeiro: as outras não sobrepõem
    const livre = ocupado ? cs.subtract(ocupado) : cs;
    if (!livre.isEmpty()) pecas.push([`cor${k + 1}`, extr(livre, p.espBase, p.espBase + p.relevo * (p.degraus ? 1 + k * 0.6 : 1))]);
    ocupado = ocupado ? ocupado.add(cs) : cs;
  }
  return { partes: pecas, cores: q.cores, W, H };
}
// contorno de uma máscara com posição exata (pixel i,j -> retângulo na área W×H centrada)
function imagemParaSecaoAlinhada(img, W, H, s) {
  const C = CS(), linhas = [];
  for (let j = 0; j < img.height; j++) {
    let i = 0;
    while (i < img.width) {
      if (img.data[(j * img.width + i) * 4] > 127) { i++; continue; }
      let f = i; while (f + 1 < img.width && img.data[(j * img.width + f + 1) * 4] <= 127) f++;
      linhas.push(C.square([(f - i + 1) * s + 0.002, s + 0.002], false).translate([-W / 2 + i * s, H / 2 - (j + 1) * s]));
      i = f + 1;
    }
  }
  if (!linhas.length) return null;
  // une e suaviza um pouco o serrilhado dos pixels
  const u = C.union(linhas), k = s * 0.35;
  return u.offset(k, 'Round', 2, 12).offset(-k, 'Round', 2, 12);
}

// ---------- 18. QR artístico (módulos redondos, olhos arredondados, logo no meio) ----------
export function layoutQrArtistico(texto, logo, p) {
  const C = CS();
  const m = qrMatriz(texto, logo ? 'H' : 'M'), n = m.length, W = p.lado, z = p.zonaQuieta;
  const s = W / (n + 2 * z), off = -n * s / 2;
  const olho = (i, j) => (i < 7 && j < 7) || (i >= n - 7 && j < 7) || (i < 7 && j >= n - 7);
  const raioLogo = logo ? W * p.tamLogo / 2 : 0;
  const mods = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!m[j][i] || olho(i, j)) continue;
    const x = off + i * s + s / 2, y = -(off + j * s + s / 2);
    if (logo && Math.hypot(x, y) < raioLogo + s * 0.8) continue;
    mods.push(p.estilo === 'pontos' ? C.circle(s * 0.47, 16).translate([x, y]) : p.estilo === 'quadrados' ? C.square([s + 0.01, s + 0.01], true).translate([x, y]) : retArred(s * 0.96, s * 0.96, s * 0.32).translate([x, y]));
  }
  for (const [i, j] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    const x = off + i * s + 3.5 * s, y = -(off + j * s + 3.5 * s);
    mods.push(retArred(7 * s, 7 * s, 2.2 * s).subtract(retArred(5 * s, 5 * s, 1.5 * s)).translate([x, y]), retArred(3 * s, 3 * s, s).translate([x, y]));
  }
  const qr = C.union(mods);
  const placa = retArred(W, W, p.raio);
  let logoCs = null;
  if (logo) logoCs = cent(caber(logo, raioLogo * 1.5, raioLogo * 1.5));
  return { qr, placa, logo: logoCs, n, modulo: s, W };
}
export function geoQrArtistico(L, p) {
  const e = p.espessura, pecas = [['placa', extr(L.placa, 0, e)], ['qr', extr(L.qr, e, e + p.relevo)]];
  if (L.logo) pecas.push(['logo', extr(L.logo, e, e + p.relevo)]);
  if (!p.base) return { montado: pecas, imprimir: pecas };
  const B = baseApoio(L.W, e + p.relevo, { folgaBase: 0.3, profBase: p.profBase, altBase: 14 });
  pecas[0][1] = extr(L.placa.add(abaEncaixe(L.placa, 14)), 0, e);
  const yMin = pecas[0][1].boundingBox().min[1];
  const emPe = mm => mm.translate([0, -yMin, -(e + p.relevo) / 2]).rotate([90, 0, 0]).translate([0, 0, 3]);
  const dx = L.W / 2 + B.baseL / 2 + 8;
  return { montado: [...pecas.map(([id, m]) => [id, emPe(m)]), ['base', B.base.translate([-dx, 0, 0])]], imprimir: arrumarNaMesa([...pecas.map(([id, m]) => [id, m, 'qr']), ['base', B.base]]) };
}
