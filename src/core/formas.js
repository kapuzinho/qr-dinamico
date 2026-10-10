// Formas 2D (CrossSection do manifold): texto, imagem, SVG e QR code
import QRCode from 'qrcode';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { M } from './motor.js';

const CS = () => M().CrossSection;

export function tamanho(cs) { const b = cs.bounds(); return [b.max[0] - b.min[0], b.max[1] - b.min[1]]; }
export function centralizar(cs) {
  const b = cs.bounds();
  return cs.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]);
}

export function comandosParaPoligonos(cmds, passos = 10) {
  const polys = [];
  let cur = null, x0 = 0, y0 = 0, sx = 0, sy = 0;
  for (const c of cmds) {
    if (c.type === 'M') { cur = [[c.x, -c.y]]; polys.push(cur); x0 = sx = c.x; y0 = sy = c.y; continue; }
    if (c.type === 'Z') { x0 = sx; y0 = sy; cur = null; continue; }
    if (!cur) continue;
    if (c.type === 'L') cur.push([c.x, -c.y]);
    else if (c.type === 'Q') {
      for (let i = 1; i <= passos; i++) {
        const t = i / passos, a = (1 - t) ** 2, b = 2 * (1 - t) * t, d = t * t;
        cur.push([a * x0 + b * c.x1 + d * c.x, -(a * y0 + b * c.y1 + d * c.y)]);
      }
    } else if (c.type === 'C') {
      for (let i = 1; i <= passos; i++) {
        const t = i / passos, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, d = 3 * (1 - t) * t * t, e = t ** 3;
        cur.push([a * x0 + b * c.x1 + d * c.x2 + e * c.x, -(a * y0 + b * c.y1 + d * c.y2 + e * c.y)]);
      }
    }
    x0 = c.x; y0 = c.y;
  }
  return polys.filter(p => p.length >= 3);
}

// monta a linha glifo por glifo (sem GSUB: evita erro do opentype.js com algumas fontes)
function linhaDeTexto(font, txt, tam, espacamento) {
  const s = tam / font.unitsPerEm;
  let x = 0, ant = null;
  const cmds = [];
  for (const ch of txt) {
    const g = font.charToGlyph(ch);
    if (ant) x += font.getKerningValue(ant, g) * s;
    cmds.push(...g.getPath(x, 0, tam).commands);
    x += g.advanceWidth * s + espacamento * tam;
    ant = g;
  }
  return { cmds, largura: x };
}

export function textoParaSecao(font, texto, { altura = 10, espacamento = 0, entreLinhas = 1.25, alinhamento = 'centro', negrito = 0 } = {}) {
  const tam = 100;
  const linhas = String(texto).replace(/\r/g, '').split('\n');
  const med = linhas.map(l => linhaDeTexto(font, l, tam, espacamento));
  const maxL = Math.max(...med.map(m => m.largura));
  let escala = null;
  const polys = [];
  med.forEach((m, i) => {
    const dx = alinhamento === 'esquerda' ? 0 : alinhamento === 'direita' ? maxL - m.largura : (maxL - m.largura) / 2;
    const dy = i * tam * entreLinhas;
    const p = comandosParaPoligonos(m.cmds.map(c => ({ ...c, x: c.x + dx, x1: c.x1 + dx, x2: c.x2 + dx, y: c.y + dy, y1: c.y1 + dy, y2: c.y2 + dy })));
    if (p.length && escala === null) { const [, h] = tamanho(new (CS())(p, 'NonZero')); if (h > 0) escala = altura / h; }
    polys.push(...p);
  });
  if (!polys.length || !escala) throw new Error('Digite um texto que exista nessa fonte.');
  let cs = new (CS())(polys, 'NonZero').scale([escala, escala]);
  if (negrito > 0) cs = cs.offset(negrito, 'Round', 2, 32);
  return centralizar(cs.simplify(0.01));
}

export function textoAlturaPadrao(font, texto, altura, extra = {}) { return textoParaSecao(font, texto, { altura, ...extra }); }

// ---------- imagem raster: marching squares na máscara binária ----------
const SEG = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[0, 1], [3, 2]], [[0, 2]], [[3, 0]], [[3, 0]], [[0, 2]], [[3, 0], [2, 1]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];

export function contornosDaMascara(mask, W, H) {
  const L = 2 * W + 3;
  const chave = (x, y, e) => (e === 0 ? 2 * x + 1 + 2 * y * L : e === 1 ? 2 * x + 2 + (2 * y + 1) * L : e === 2 ? 2 * x + 1 + (2 * y + 2) * L : 2 * x + (2 * y + 1) * L);
  const segA = [], segB = [];
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const c = mask[y * W + x] * 8 + mask[y * W + x + 1] * 4 + mask[(y + 1) * W + x + 1] * 2 + mask[(y + 1) * W + x];
      for (const [a, b] of SEG[c]) { segA.push(chave(x, y, a)); segB.push(chave(x, y, b)); }
    }
  }
  const adj = new Map();
  const liga = (k, i) => { const l = adj.get(k); if (l) l.push(i); else adj.set(k, [i]); };
  segA.forEach((k, i) => liga(k, i));
  segB.forEach((k, i) => liga(k, i));
  const usado = new Uint8Array(segA.length);
  const laços = [];
  for (let s = 0; s < segA.length; s++) {
    if (usado[s]) continue;
    usado[s] = 1;
    const inicio = segA[s];
    let ponta = segB[s];
    const pts = [inicio];
    while (ponta !== inicio) {
      pts.push(ponta);
      const prox = adj.get(ponta).find(i => !usado[i]);
      if (prox === undefined) break;
      usado[prox] = 1;
      ponta = segA[prox] === ponta ? segB[prox] : segA[prox];
    }
    if (pts.length >= 3) laços.push(pts.map(k => [(k % L) / 2, -Math.floor(k / L) / 2]));
  }
  return laços;
}

export function imagemParaSecao(img, { limiar = 128, inverter = false, largura = 30, altura = 0 } = {}) {
  const W = img.width + 2, H = img.height + 2, mask = new Uint8Array(W * H);
  const d = img.data;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const opaco = d[i + 3] > 127;
      const escuro = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < limiar;
      mask[(y + 1) * W + x + 1] = opaco && escuro !== inverter ? 1 : 0;
    }
  }
  const laços = contornosDaMascara(mask, W, H);
  if (!laços.length) throw new Error('Nada ficou preto com esse limiar. Mude o limiar ou marque Inverter.');
  return ajustarTamanho(new (CS())(laços, 'EvenOdd'), largura, altura);
}

function ajustarTamanho(cs, largura, altura) {
  const [w, h] = tamanho(cs);
  let sx = largura > 0 ? largura / w : 0, sy = altura > 0 ? altura / h : 0;
  if (!sx) sx = sy || 1;
  if (!sy) sy = sx;
  return centralizar(cs.scale([sx, sy]).simplify(0.03));
}

export async function lerImagem(arquivo, maximo = 800) {
  const bmp = await createImageBitmap(arquivo);
  const f = Math.min(1, maximo / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * f));
  c.height = Math.max(1, Math.round(bmp.height * f));
  const g = c.getContext('2d');
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return g.getImageData(0, 0, c.width, c.height);
}

// ---------- SVG vetorial, sem rasterizar ----------
export function svgParaSecao(textoSvg, { largura = 30, altura = 0, ignorarBranco = true } = {}) {
  const dados = new SVGLoader().parse(textoSvg);
  const partes = [];
  for (const p of dados.paths) {
    const st = p.userData?.style || {};
    if (st.fill === 'none' || st.fill === 'transparent' || st.fillOpacity === 0) continue;
    if (ignorarBranco && p.color && p.color.r > 0.92 && p.color.g > 0.92 && p.color.b > 0.92) continue;
    const polys = p.subPaths.map(sp => sp.getPoints(60).map(v => [v.x, -v.y])).filter(a => a.length >= 3);
    if (polys.length) partes.push(new (CS())(polys, st.fillRule === 'evenodd' ? 'EvenOdd' : 'NonZero'));
  }
  if (!partes.length) throw new Error('O SVG não tem formas preenchidas (só contornos não viram relevo).');
  return ajustarTamanho(CS().union(partes), largura, altura);
}

// ---------- imagem/SVG em duas cores (fundo cheio + detalhes internos) ----------
function areaPoly(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return a / 2; }
// tapa os buracos: pra cada pedaço, mantém só o anel de MAIOR área (o contorno externo)
function contornoExterno(cs) {
  const cheios = [];
  for (const comp of cs.decompose()) {
    const aneis = comp.toPolygons();
    if (!aneis.length) continue;
    let melhor = aneis[0], maxA = Math.abs(areaPoly(aneis[0]));
    for (const p of aneis) { const a = Math.abs(areaPoly(p)); if (a > maxA) { maxA = a; melhor = p; } }
    cheios.push(new (CS())([melhor], 'NonZero'));
  }
  if (!cheios.length) return cs;
  return CS().union(cheios).simplify(0.03);
}


// limpeza da máscara binária: remove manchinhas e tampa furinhos (abre+fecha), suaviza bordas de PNG
function limparMascara(mask, W, H, raio) {
  const copia = () => mask.slice();
  const dilata = (src, r) => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let on = 0;
      for (let dy = -r; dy <= r && !on; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && src[ny * W + nx]) { on = 1; break; }
      }
      out[y * W + x] = on;
    }
    return out;
  };
  const erode = (src, r) => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let all = 1;
      for (let dy = -r; dy <= r && all; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H || !src[ny * W + nx]) { all = 0; break; }
      }
      out[y * W + x] = all;
    }
    return out;
  };
  // fecha (tapa furinhos) e abre (remove manchinhas)
  let m = erode(dilata(mask, raio), raio);   // close
  m = dilata(erode(m, raio), raio);          // open
  return m;
}

function mascaraSecao(img, limiar, inverter) {
  const W = img.width + 2, H = img.height + 2, mask = new Uint8Array(W * H);
  const d = img.data;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4;
    const opaco = d[i + 3] > 127;
    const escuro = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < limiar;
    mask[(y + 1) * W + x + 1] = opaco && escuro !== inverter ? 1 : 0;
  }
  // raio de limpeza proporcional ao tamanho da imagem (mínimo 1px)
  const raio = Math.max(1, Math.round(Math.min(img.width, img.height) / 180));
  const limpa = limparMascara(mask, W, H, raio);
  const lacos = contornosDaMascara(limpa, W, H);
  if (!lacos.length) return null;
  // escala do mundo ~ tamanho em mm depois; simplify em px deixa a borda lisa
  return new (CS())(lacos, 'EvenOdd').simplify(Math.max(0.6, raio * 0.8));
}

// retorna { cheio, detalhe }: cheio = silhueta com buracos tapados (fundo); detalhe = regiões internas claras
export function imagemDuasCores(img, { limiar = 128, largura = 60, altura = 0 } = {}) {
  const escuro = mascaraSecao(img, limiar, false);
  if (!escuro) throw new Error('Nada ficou escuro com esse limiar. Ajuste o limiar.');
  const cheio = contornoExterno(escuro);
  const detalhe = cheio.subtract(escuro);          // buracos internos = detalhe claro
  const [w, h] = tamanho(cheio);
  let sx = largura > 0 ? largura / w : 1, sy = altura > 0 ? altura / h : sx;
  if (!sy) sy = sx;
  const aj = cs => centralizar(cs.scale([sx, sy]));
  return { cheio: aj(cheio), detalhe: aj(detalhe) };
}

export function svgDuasCores(textoSvg, { largura = 60, altura = 0 } = {}) {
  // comBuracos = silhueta com olhos/nariz vazados (robusto, via subPaths EvenOdd)
  const comBuracos = svgParaSecao(textoSvg, { largura, altura, ignorarBranco: false });
  const cheio = contornoExterno(comBuracos);     // tapa os buracos = fundo
  const detalhe = cheio.subtract(comBuracos);    // os buracos = detalhe (olhos, nariz)
  return { cheio, detalhe };
}

// ---------- QR code ----------
export function qrParaSecao(texto, lado, { ecc = 'M' } = {}) {
  if (!texto) throw new Error('Digite o texto ou link do QR code.');
  const q = QRCode.create(texto, { errorCorrectionLevel: ecc });
  const n = q.modules.size, m = lado / n;
  const rects = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!q.modules.get(r, c)) { c++; continue; }
      let e = c;
      while (e < n && q.modules.get(r, e)) e++;
      const x0 = c * m, x1 = e * m, y0 = -(r + 1) * m, y1 = -r * m;
      rects.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
      c = e;
    }
  }
  return { cs: new (CS())(rects, 'Positive').translate([-lado / 2, lado / 2]), modulos: n, modulo: m };
}

export function desenharQR(g, texto, x, y, lado, { ecc = 'M', cor = '#000' } = {}) {
  const q = QRCode.create(texto, { errorCorrectionLevel: ecc });
  const n = q.modules.size, m = lado / n;
  g.fillStyle = cor;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules.get(r, c)) g.fillRect(x + c * m, y + r * m, Math.ceil(m), Math.ceil(m));
}

// ---------- SVG multicolorido: uma forma por cor de preenchimento ----------
// Respeita a ordem de pintura (o que vem depois cobre o que vem antes) e junta cores além de "maxCores"
// na cor mais parecida. Devolve [{ cor: 0xRRGGBB, cs }] em coordenadas do SVG (y pra cima), maiores primeiro.
export function svgPorCores(textoSvg, { ignorarBranco = true, maxCores = 3 } = {}) {
  const dados = new SVGLoader().parse(textoSvg);
  const grupos = new Map();   // cor -> cs
  for (const p of dados.paths) {
    const st = p.userData?.style || {};
    if (st.fill === 'none' || st.fill === 'transparent' || st.fillOpacity === 0 || !p.color) continue;
    const branco = p.color.r > 0.92 && p.color.g > 0.92 && p.color.b > 0.92;
    const polys = p.subPaths.map(sp => sp.getPoints(60).map(v => [v.x, -v.y])).filter(a => a.length >= 3);
    if (!polys.length) continue;
    const cs = new (CS())(polys, st.fillRule === 'evenodd' ? 'EvenOdd' : 'NonZero');
    // o que vem por cima "apaga" as cores de baixo
    for (const [k, g] of grupos) grupos.set(k, g.subtract(cs));
    if (branco && ignorarBranco) continue;   // branco por cima vira "furo" (mostra o corpo)
    const cor = p.color.getHex();
    grupos.set(cor, grupos.has(cor) ? grupos.get(cor).add(cs) : cs);
  }
  let lista = [...grupos].map(([cor, cs]) => ({ cor, cs })).filter(g => !g.cs.isEmpty() && g.cs.area() > 1e-6);
  if (!lista.length) throw new Error('O SVG não tem formas preenchidas (só contornos não viram relevo).');
  lista.sort((a, b) => b.cs.area() - a.cs.area());
  const dist = (a, b) => [16, 8, 0].reduce((s, k) => s + (((a >> k) & 255) - ((b >> k) & 255)) ** 2, 0);
  while (lista.length > maxCores) {
    const menor = lista.pop();
    let alvo = lista[0];
    for (const g of lista) if (dist(g.cor, menor.cor) < dist(alvo.cor, menor.cor)) alvo = g;
    alvo.cs = alvo.cs.add(menor.cs);
  }
  return lista;
}

// matriz booleana do QR (linhas de cima pra baixo), pra desenhos personalizados (módulos redondos etc.)
export function qrMatriz(texto, ecc = 'M') {
  if (!texto) throw new Error('Digite o texto ou link do QR code.');
  const q = QRCode.create(texto, { errorCorrectionLevel: ecc });
  const n = q.modules.size, m = [];
  for (let r = 0; r < n; r++) { const l = []; for (let c = 0; c < n; c++) l.push(!!q.modules.get(r, c)); m.push(l); }
  return m;
}
