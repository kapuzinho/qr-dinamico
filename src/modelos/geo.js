// Geometria dos modelos paramétricos (placa de profissão, porta caneta)
import { M } from '../core/motor.js';
import { tamanho } from '../core/formas.js';

const CS = () => M().CrossSection;
export const larg = cs => { const b = cs.bounds(); return b.max[0] - b.min[0]; };
export const alt = cs => { const b = cs.bounds(); return b.max[1] - b.min[1]; };
// posiciona a forma com o canto inferior-esquerdo em (x, y)
export const colocar = (cs, x, y) => { const b = cs.bounds(); return cs.translate([x - b.min[0], y - b.min[1]]); };
// posiciona centralizado em x, base em y
export const centroX = (cs, cx, y) => { const b = cs.bounds(); return cs.translate([cx - (b.min[0] + b.max[0]) / 2, y - b.min[1]]); };
export function retArred(w, h, r) {
  r = Math.max(0, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  const base = CS().square([w, h], true);
  return r > 0 ? CS().square([w - 2 * r, h - 2 * r], true).offset(r, 'Round', 2, 64) : base;
}

// ---------------- Placa de profissão ----------------
// partes: { simbolo: cs|null, nome: cs, profissao: cs|null }  (já na escala certa)
export function comporPlaca(partes, p) {
  const gap = p.alturaNome * 0.28;
  const temSimbolo = !!partes.simbolo;
  const temProf = !!partes.profissao;
  // bloco de texto: nome em cima, profissão embaixo
  const hProf = temProf ? alt(partes.profissao) : 0;
  const hTexto = alt(partes.nome) + (temProf ? hProf + gap * 0.6 : 0);
  const larguraTexto = Math.max(larg(partes.nome), temProf ? larg(partes.profissao) : 0);
  const larguraSimbolo = temSimbolo ? larg(partes.simbolo) : 0;
  const alturaSimbolo = temSimbolo ? alt(partes.simbolo) : 0;
  const alturaConteudo = Math.max(hTexto, alturaSimbolo);
  const xTexto = temSimbolo ? larguraSimbolo + gap : 0;

  const out = {};
  const yBaseTexto = (alturaConteudo - hTexto) / 2; // centraliza o bloco de texto na vertical
  out.nome = colocar(partes.nome, xTexto, yBaseTexto + (temProf ? hProf + gap * 0.6 : 0));
  if (temProf) {
    const dw = larg(partes.nome) - larg(partes.profissao);
    const dx = p.alinhProf === 'centro' ? dw / 2 : p.alinhProf === 'direita' ? dw : 0;
    out.profissao = colocar(partes.profissao, xTexto + dx, yBaseTexto);
  }
  if (temSimbolo) out.simbolo = colocar(partes.simbolo, 0, (alturaConteudo - alturaSimbolo) / 2);

  out.larguraConteudo = xTexto + larguraTexto;
  out.alturaConteudo = alturaConteudo;
  return out;
}

export function geoPlaca(partes, p) {
  const c = comporPlaca(partes, p);
  const W = c.larguraConteudo + 2 * p.margem;
  const H = c.alturaConteudo + 2 * p.margem;
  // centraliza tudo no painel (que fica com centro em 0,0)
  const desl = cs => cs.translate([-W / 2 + p.margem, -H / 2 + p.margem]);
  const painel2d = retArred(W, H, p.raio);
  const nome = desl(c.nome), profissao = c.profissao ? desl(c.profissao) : null, simbolo = c.simbolo ? desl(c.simbolo) : null;

  const partes3d = [];
  if (p.modo === 'rente') {
    // partes embutidas rente ao topo do painel
    const d = Math.min(p.relevo, p.espPainel - 0.6);
    let painel = painel2d.extrude(p.espPainel);
    const inlay = (cs) => cs.extrude(d).translate([0, 0, p.espPainel - d]);
    for (const [id, cs] of [['nome', nome], ['profissao', profissao], ['simbolo', simbolo]]) {
      if (!cs) continue;
      const pocket = cs.offset(0.1, 'Round', 2, 16).extrude(d + 0.02).translate([0, 0, p.espPainel - d]);
      painel = painel.subtract(pocket);
      partes3d.push([id, inlay(cs)]);
    }
    partes3d.unshift(['painel', painel]);
  } else {
    // partes em relevo sobre o painel
    partes3d.push(['painel', painel2d.extrude(p.espPainel)]);
    for (const [id, cs] of [['nome', nome], ['profissao', profissao], ['simbolo', simbolo]]) {
      if (cs) partes3d.push([id, cs.extrude(p.relevo).translate([0, 0, p.espPainel - 0.01])]);
    }
  }

  // "painel na base": fenda no topo da base; o painel encaixa nela e sobe do meio
  const arquivos = partes3d.map(([id, m]) => [id, m]);
  let base = null;
  const montarEmPe = p.base === 'painel';
  const insercao = Math.min(p.baseAlt * 0.6, 8); // o painel entra só o necessário pra firmar
  const fendaY = p.fendaY || 0;
  if (montarEmPe) {
    const bw = W, bd = p.baseProf, bh = p.baseAlt;
    const fenda = CS().square([bw + 4, p.espPainel + p.folga], true).translate([0, fendaY]).extrude(insercao + 0.2).translate([0, 0, bh - insercao]);
    base = retArred(bw, bd, Math.min(p.raio, bd / 2 - 0.5, bh / 2 - 0.2)).extrude(bh).subtract(fenda);
    arquivos.push(['base', base]);
  }
    return { partes: partes3d, base, montarEmPe, W, H, params: p, fendaY, insercao };
}

// ---------------- Porta caneta: frente = silhueta do nome + SVG; caixa atrás ----------------
export function geoPortaCaneta(partes, p) {
  const cs = CS();
  const Man = M().Manifold;
  const temTexto = !!partes.texto, temSvg = !!partes.svg;
  if (!temTexto && !temSvg) throw new Error('Digite um texto ou escolha um SVG.');

  // ---- composição da FRENTE (vista de frente: X largura, Y altura, base em 0) ----
  const t = temTexto ? centroX(partes.texto, 0, 0) : null;
  const th = t ? alt(t) : 0;
  const ct = Math.max(0.5, Math.min(p.contornoTexto ?? 1.5, th * 0.12));
  let sPos = null, sh = 0;
  if (temSvg) {
    const s0 = centroX(partes.svg, 0, 0);
    sh = alt(s0);
    // base do SVG fica ACIMA do topo do nome; só os contornos se tocam (não sobrepõe o desenho no texto)
    const folga = Math.max(ct + (p.contornoArte ?? 2.5) + 0.5, 3); // afasta o SVG pelo tanto dos dois contornos
    const yBase = temTexto ? th + folga : 0;
    sPos = s0.translate([p.artePosX, yBase + (p.artePosY || 0)]);
  }
  const silT = t ? t.offset(ct, 'Round', 2, 40) : null;
  const silS = sPos ? sPos.offset(p.contornoArte ?? 2.5, 'Round', 2, 40) : null;
  let frontSil = silT && silS ? silT.add(silS) : (silT || silS);
  frontSil = frontSil.simplify(0.05);

  // largura da caixa pela largura do texto (ou do SVG)
  const larguraBase = temTexto ? larg(partes.texto) : larg(partes.svg);
  const W = larguraBase + 2 * p.margem;
  const D = p.profundidade, H = p.altura;

  // ---- bandeja (caixa oca com compartimentos) ----
  const ext = retArred(W, D, p.raio);
  const cav = ext.offset(-p.parede, 'Round', 2, 32);
  if (cav.isEmpty()) throw new Error('Parede grossa demais pra essa largura.');
  let corpo = ext.extrude(H).subtract(cav.extrude(H - p.piso).translate([0, 0, p.piso]));
  const n = Math.max(1, Math.round(p.compartimentos));
  if (n > 1) {
    const passo = W / n, divs = [];
    for (let i = 1; i < n; i++) {
      const x = -W / 2 + i * passo;
      divs.push(cs.square([p.parede, D], true).translate([x, 0]).intersect(ext).extrude(H - p.piso).translate([0, 0, p.piso]));
    }
    corpo = corpo.add(Man.union(divs));
  }

  // ---- parede frontal (silhueta) encostada na frente da caixa ----
  const espFrente = p.parede + 1.2;
  const yFrenteCaixa = -D / 2;
  // z=0 corresponde à base de TODA a composição (menor y entre texto e svg já posicionados)
  const zBaseComp = Math.min(t ? t.bounds().min[1] : Infinity, sPos ? sPos.bounds().min[1] : Infinity);
  const elevar = p.elevarNome ?? 6;                 // folga do nome até a base (não encostar no chão)
  const emPe3 = (forma, esp, yFace) => {            // preserva a altura relativa (y da composição vira z)
    const m = forma.extrude(esp).rotate([90, 0, 0]);
    const b = m.boundingBox();
    return m.translate([0, yFace - b.min[1], -zBaseComp + elevar]);
  };
  const paredeFrente = emPe3(frontSil, espFrente, yFrenteCaixa - espFrente);
  corpo = corpo.add(paredeFrente);

  const partes3d = [['corpo', corpo]];
  const yFaceFrente = yFrenteCaixa - espFrente;      // face da frente da parede
  if (t) partes3d.push(['texto', emPe3(t, p.relevoTexto, yFaceFrente - p.relevoTexto)]);
  if (sPos) partes3d.push(['arte', emPe3(sPos, p.relevoArte, yFaceFrente - p.relevoArte)]);

  return { partes: partes3d, W, D, H, params: p };
}

// ---------------- Placa de profissão: base sólida com letras/símbolo em pé ----------------
// coloca uma forma 2D "em pé" sobre a base: extruda a espessura, gira pra vertical e apoia no topo
function emPe(cs2d, esp, Hbase) {
  const m = cs2d.extrude(esp).rotate([90, 0, 0]); // altura da letra vira Z, espessura vira Y
  const b = m.boundingBox();
  return m.translate([0, 0, Hbase - b.min[2]]); // apoia a base da letra no topo do plinto
}
const centroXY = (m, cx, cy) => { const b = m.boundingBox(); return m.translate([cx - (b.min[0] + b.max[0]) / 2, cy - (b.min[1] + b.max[1]) / 2, 0]); };

export function geoPlacaSolida(partes, p) {
  const gap = alt(partes.nome) * 0.28;
  const temSimbolo = !!partes.simbolo, temProf = !!partes.profissao;
  const ws = temSimbolo ? larg(partes.simbolo) : 0;
  const wn = larg(partes.nome);
  const larguraConteudo = ws + (temSimbolo ? gap : 0) + wn;
  const W = larguraConteudo + 2 * p.margem;
  const D = p.baseProf, Hb = p.baseAlt;
  const base = retArred(W, D, Math.min(p.raio, D / 2 - 0.5, Hb / 2 - 0.2)).extrude(Hb);

  const dir = p.posSimbolo === 'direita';
  const simCx = dir ? (larguraConteudo / 2 - ws / 2) : (-larguraConteudo / 2 + ws / 2);
  const nomeCx = dir ? (-larguraConteudo / 2 + wn / 2) : (larguraConteudo / 2 - wn / 2);

  const partes3d = [['base', base]];
  const yTopo = 0; // centralizado na profundidade da base
  partes3d.push(['nome', centroXY(emPe(partes.nome, p.espLetra, Hb), nomeCx, yTopo)]);
  if (temSimbolo) partes3d.push(['simbolo', centroXY(emPe(partes.simbolo, p.espSimbolo, Hb), simCx, yTopo)]);
  if (temProf) {
    const alturaProf = alt(partes.profissao);
    const z = Math.max(1.5, (Hb - alturaProf) / 2);
    const prof = partes.profissao.extrude(p.relevo).rotate([90, 0, 0]);
    const b = prof.boundingBox();
    partes3d.push(['profissao', prof.translate([-((b.min[0] + b.max[0]) / 2), -D / 2 - b.min[1] - 0.01, z - b.min[2]])]);
  }
  return { partes: partes3d, base, W, H: Hb, montarEmPe: false, solida: true, params: p };
}

export function geoPlacaLetrasSoltas(partes, p) {
  const cs = CS();
  const gap = alt(partes.nome) * 0.28;
  const temS = !!partes.simbolo, temProf = !!partes.profissao;
  const ws = temS ? larg(partes.simbolo) : 0, wn = larg(partes.nome);
  const contentW = ws + (temS ? gap : 0) + wn;
  const esp = p.espLetra, bf = p.baseFina, folga = p.folga, fendaY = p.fendaY || 0;

  // placa fina: onde as letras ficam coladas
  const placaW = contentW + 2 * p.margem;
  const placaD = Math.max(esp + 8, 16);
  // base principal em volta, com bolso do tamanho da placa (+folga pra colar)
  const baseW = placaW + 2 * p.margem;
  const baseD = placaD + 2 * p.margem;
  const Hb = p.baseAlt;

  const bolso = cs.square([placaW + folga, placaD + folga], true).translate([0, fendaY]).extrude(bf + 0.1).translate([0, 0, Hb - bf]);
  const base = retArred(baseW, baseD, Math.min(p.raio, baseD / 2 - 0.5, Hb / 2 - 0.2)).extrude(Hb).subtract(bolso);
  const placa = cs.square([placaW, placaD], true).translate([0, fendaY]).extrude(bf).translate([0, 0, Hb - bf]);

  // símbolo à esquerda/direita do nome, grupo centralizado
  const dir = p.posSimbolo === 'direita';
  const simCx = dir ? (contentW / 2 - ws / 2) : (-contentW / 2 + ws / 2);
  const nomeCx = dir ? (-contentW / 2 + wn / 2) : (contentW / 2 - wn / 2);
  // letras em pé, apoiadas no topo da placa (z = Hb), coladas 0.8mm
  const emPe2 = (cs2d, espp, cx) => {
    const m = cs2d.extrude(espp).rotate([90, 0, 0]);
    const b = m.boundingBox();
    return m.translate([cx - (b.min[0] + b.max[0]) / 2, fendaY - (b.min[1] + b.max[1]) / 2, Hb - 0.8 - b.min[2]]);
  };

  const partes3d = [['base', base], ['placa', placa]];
  partes3d.push(['nome', emPe2(partes.nome, esp, nomeCx)]);
  if (temS) partes3d.push(['simbolo', emPe2(partes.simbolo, p.espSimbolo, simCx)]);
  if (temProf) {
    const alturaProf = alt(partes.profissao);
    const z = Math.max(1.5, (Hb - alturaProf) / 2);
    const prof = partes.profissao.extrude(p.relevo).rotate([90, 0, 0]);
    const b = prof.boundingBox();
    partes3d.push(['profissao', prof.translate([-((b.min[0] + b.max[0]) / 2), -baseD / 2 - b.min[1] - 0.01, z - b.min[2]])]);
  }
  return { partes: partes3d, base, placa, W: baseW, H: Hb, montarEmPe: false, params: p };
}

// ---------------- Porta chave (arte + barra com pinos e furos de parafuso) ----------------
// partes: { cheio: cs (silhueta cheia), detalhe: cs|null (detalhes claros) }
export function geoPortaChave(partes, p) {
  const cs = CS();
  const Man = M().Manifold;
  const arte2d = partes.cheio;                       // silhueta cheia do desenho
  const ab = arte2d.bounds();
  const Wart = ab.max[0] - ab.min[0], Hart = ab.max[1] - ab.min[1];

  // contorno externo em volta do desenho (mesmo estilo da luminária)
  const ct = p.contorno ?? 2.5;
  const corpo2d = arte2d.offset(ct, 'Round', 2, 40).simplify(0.05);
  const cb = corpo2d.bounds();
  const meio = (cb.min[0] + cb.max[0]) / 2;

  const espArte = p.espArte, espDet = p.espDetalhe, espContorno = espArte + 1;

  // ---- barra embaixo, com o mesmo contorno ----
  const barW = Math.max((cb.max[0] - cb.min[0]) * p.larguraBarra, 40);
  const barH = p.alturaBarra, esp = p.espBarra;
  const yBar = cb.min[1] - barH * 0.3;
  const barraMiolo = retArred(barW, barH, Math.min(p.raio, barH / 2 - 0.5)).translate([meio, yBar + barH / 2]);
  const barraContorno = barraMiolo.offset(ct, 'Round', 2, 24);

  // corpo = contorno do desenho + contorno da barra, numa peça só (atrás, cor escura)
  let corpo = corpo2d.add(barraContorno).extrude(espContorno);
  // o miolo da barra sobe mais (onde ficam pinos/furos)
  const barra3d = barraMiolo.extrude(esp).translate([0, 0, 0]);
  corpo = corpo.add(barra3d);

  // furos de parafuso (2) na barra
  const rFuro = p.furoParafuso / 2;
  const margemFuro = Math.max(barW * 0.12, rFuro + 3);
  for (const sx of [-1, 1]) {
    const cxF = meio + sx * (barW / 2 - margemFuro);
    corpo = corpo.subtract(Man.cylinder(esp + espContorno + 2, rFuro, rFuro, 48, false).translate([cxF, yBar + barH / 2, -1]));
  }
  // pinos pra chave
  const nPinos = Math.max(1, Math.round(p.pinos));
  const rPino = p.diamPino / 2, compPino = p.compPino, rCabeca = rPino * 1.6;
  const vaoPino = barW / (nPinos + 1), yPino = yBar + barH * 0.32;
  const pinos = [];
  for (let i = 1; i <= nPinos; i++) {
    const cxP = meio - barW / 2 + i * vaoPino;
    const haste = Man.cylinder(compPino, rPino, rPino, 32, false);
    const cabeca = Man.cylinder(rCabeca * 0.8, rCabeca, rCabeca, 32, false).translate([0, 0, compPino - rCabeca * 0.8]);
    pinos.push(Man.union([haste, cabeca]).translate([cxP, yPino, esp - 0.5]));
  }
  if (pinos.length) corpo = corpo.add(Man.union(pinos));

  // ---- desenho (fundo/cor) em cima do contorno ----
  let fundo = arte2d.extrude(espArte).translate([0, 0, espContorno]);
  if (partes.detalhe && !partes.detalhe.isEmpty()) {
    const pocket = partes.detalhe.extrude(espDet + 0.01).translate([0, 0, espContorno + espArte - espDet]);
    fundo = fundo.subtract(pocket);
  }

  const partes3d = [['corpo', corpo], ['fundo', fundo]];
  if (partes.detalhe && !partes.detalhe.isEmpty()) {
    partes3d.push(['detalhe', partes.detalhe.extrude(espDet).translate([0, 0, espContorno + espArte - espDet])]);
  }
  return { partes: partes3d, W: cb.max[0] - cb.min[0], H: (cb.max[1] - cb.min[1]) + barH, params: p };
}

// ---------------- Luminária (frente luminosa: corpo + fundo + arte, com furos atrás) ----------------
// partes: { texto: cs|null, svg: cs|null, svgDetalhe: cs|null }  (arte = texto ∪ svg; detalhe = buracos claros do svg)

// acha um ponto dentro da seção numa faixa (topo/baixo), recuado 'rec' da borda da faixa
function pontoSolido(cs2d, onde, rec) {
  const b = cs2d.bounds();
  const H = b.max[1] - b.min[1];
  const faixaY = onde === 'topo' ? b.max[1] - H * 0.18 : b.min[1] + H * 0.12;
  // amostra em X no centro e varre pros lados até achar material; usa o X mais central que esteja dentro
  const cx = (b.min[0] + b.max[0]) / 2;
  const dentro = (x, y) => cs2d.intersect(CS().circle(1.2, 12).translate([x, y])).area() > 3.5;
  // ajusta Y pra dentro do material (sobe/desce até achar)
  let y = faixaY;
  for (let k = 0; k < 40; k++) { if (dentro(cx, y)) break; y += (onde === 'topo' ? -1 : 1) * (H * 0.015); }
  // recua da borda: garante que há material em volta do furo
  if (!dentro(cx, y)) { y = (b.min[1] + b.max[1]) / 2; }
  return [cx, onde === 'topo' ? y - rec : y + rec];
}

export function geoLuminaria(partes, p) {
  const cs = CS();
  const Man = M().Manifold;
  const temTexto = !!partes.texto, temSvg = !!partes.svg;
  if (!temTexto && !temSvg) throw new Error('Digite um texto ou escolha um SVG.');

  // composição da arte (vista de frente): svg em cima, texto embaixo, ambos centrados em X
  const m = p.margemLuminosa;                       // margem luminosa (fundo em volta da arte)
  let arte = null;
  if (temTexto && temSvg) {
    const t = centroX(partes.texto, 0, 0);          // texto base em y=0
    const th = alt(t);
    // svg logo acima do texto, bem colado, pra virar um bloco só
    const folga = Math.max(m * 0.2, 0.5) + (p.artePosY || 0);
    const s = centroX(partes.svg, p.artePosX || 0, th + folga);
    arte = t.add(s);
  } else if (temTexto) arte = centroX(partes.texto, 0, 0);
  else arte = centroX(partes.svg, 0, 0);

  // fundo = margem luminosa em volta de TODA a arte (une texto e svg se chegam perto)
  // margem + "fechamento" (dilata e contrai) pra unir texto e svg numa silhueta só, sem vãos
  // fecha com raio = margem + ponte, depois contrai: une desenho e nome num bloco só
  const ponte = m + 4;
  const fundo2d = arte.offset(ponte, 'Round', 2, 40).offset(-(ponte - m), 'Round', 2, 40).simplify(0.05);
  const corpo2d = fundo2d.offset(p.contorno, 'Round', 2, 40).simplify(0.05);  // contorno escuro externo

  const b = corpo2d.bounds();
  const W = b.max[0] - b.min[0], Hm = b.max[1] - b.min[1];

  // ---- empilhamento em profundidade (Z) ----
  const espTras = p.espTras;                        // placa de trás (opaca)
  const espFundo = p.espFundo;                      // camada da cor (fundo)
  const espArte = p.espArte;                        // arte translúcida (frente)
  const z0 = 0;
  // corpo = placa de trás cheia (contorno externo) + parede do contorno subindo
  let corpo = corpo2d.extrude(espTras);
  // parede fina do contorno em volta do fundo, até a frente (dá o "neon" preto)
  const paredeContorno = corpo2d.subtract(fundo2d).extrude(espTras + espFundo + espArte).translate([0, 0, 0]);
  corpo = corpo.add(paredeContorno);

  // furos na placa de trás: achar pontos sólidos de verdade (dentro do corpo), recuados da borda
  const rPar = p.furoParede / 2;
  const pTopo = pontoSolido(corpo2d, 'topo', rPar + 2);
  const pBaixo = pontoSolido(corpo2d, 'baixo', p.furoFio / 2 + 2);
  const furoParede = Man.cylinder(espTras + 1, rPar, rPar, 48, false).translate([pTopo[0], pTopo[1], -0.5]);
  const canalFio = cs.square([p.furoFio, p.furoFio * 2.4], true).extrude(espTras + 1).translate([pBaixo[0], pBaixo[1], -0.5]);
  corpo = corpo.subtract(furoParede).subtract(canalFio);

  const partes3d = [['corpo', corpo]];
  // fundo = camada de cor em cima da placa de trás, dentro do contorno
  partes3d.push(['fundo', fundo2d.extrude(espFundo).translate([0, 0, espTras])]);
  // arte = texto/svg translúcido na frente
  let arteFrente = arte;
  if (partes.svgDetalhe && !partes.svgDetalhe.isEmpty()) arteFrente = arteFrente; // detalhe tratado como parte da arte
  partes3d.push(['arte', arte.extrude(espArte).translate([0, 0, espTras + espFundo])]);

  return { partes: partes3d, W, H: Hm, params: p };
}

// ---------------- Chaveiro redondo GIRATORIO (disco deitado girando num encaixe, print-in-place) ----------------
// ---------------- Chaveiro redondo (medalha: moldura + disco + arte, com argola furada) ----------------

// triângulo como CrossSection, garantindo preenchimento certo (sentido horário p/ o manifold)
function triCS(pts) {
  let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  const p = a < 0 ? pts : pts.slice().reverse();  // garante área assinada negativa (preenche o triângulo, não o infinito)
  return new (CS())([p], 'Positive');
}

export function geoChaveiroRedondo(partes, p) {
  const cs = CS();
  const Man = M().Manifold;
  const rDisco = p.diametro / 2;
  const rExt = rDisco + p.moldura;
  const espBase = p.espDisco, espArte = p.espArte;
  const temVerso = !!partes.verso;
  const altura = espBase + espArte + (temVerso ? espArte : 0);

  // argola morro no topo + aro, com furo
  const rArg = p.argola, rFuro = rArg * 0.5, cyA = rExt + rArg * 0.65;
  const cheio2d = cs.circle(rExt, 200).add(cs.circle(rArg, 96).translate([0, cyA])).offset(2.5, 'Round', 2, 48).offset(-2.5, 'Round', 2, 48);
  const moldura = cheio2d.subtract(cs.circle(rDisco, 200)).subtract(cs.circle(rFuro, 64).translate([0, cyA])).extrude(altura);

  const zBase = temVerso ? espArte : 0;
  const fundo = cs.circle(rDisco + 0.12, 200).extrude(espBase).translate([0, 0, zBase]);

  const prepara = (cheio, ehVerso) => {
    const b = cheio.bounds();
    const alvo = (rDisco - p.margemArte) * 2;
    const esc = alvo / Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
    let a = cheio.scale([esc, esc]);
    const b2 = a.bounds();
    a = a.translate([-(b2.min[0] + b2.max[0]) / 2, -(b2.min[1] + b2.max[1]) / 2]);
    if (ehVerso) a = a.mirror([1, 0]);
    return a.intersect(cs.circle(rDisco - 0.3, 200));
  };

  const partes3d = [['moldura', moldura], ['fundo', fundo]];
  partes3d.push(['arteFrente', prepara(partes.frente.cheio, false).extrude(espArte).translate([0, 0, zBase + espBase])]);
  if (temVerso) partes3d.push(['arteVerso', prepara(partes.verso.cheio, true).extrude(espArte).translate([0, 0, 0])]);
  return { partes: partes3d, W: 2 * rExt, H: 2 * rExt + rArg * 2, params: p };
}

export function geoChaveiroGiratorio(partes, p) {
  const cs = CS();
  const Man = M().Manifold;
  const rDisco = p.diametro / 2;
  const rExt = rDisco + p.moldura;
  const espBase = p.espDisco, espArte = p.espArte;
  const temVerso = !!partes.verso;
  const altura = espBase + espArte + (temVerso ? espArte : 0);  // altura do DISCO (com arte)
  const alturaAro = espBase + (temVerso ? espArte : 0);          // ARO = mesma espessura da base do disco
  const zMeio = altura / 2;
  const zCentroDisco = (temVerso ? espArte : 0) + espBase / 2;  // meia-altura do disco no espaço da peça
  // altura do eixo MEDIDA DA MESA (as duas peças assentam na mesa na montagem):
  // disco apoiado -> centro do disco fica a espBase/2 da mesa. O furo do aro usa essa mesma altura.
  const zEixoMesa = espBase / 2;
  const rPinoMax = espBase / 2 - 0.2;   // raio do pino limitado pra não ultrapassar a espessura do disco
  const folga = p.folgaGiro;                    // vao entre disco e aro

  // ---- ARO (moldura + argola) com furos de eixo nas pontas internas (cima e baixo) ----
  const rInterno = rDisco + folga;
  const rArg = p.argola, rFuroArg = rArg * 0.5, cyA = rExt + rArg * 0.65;
  const cheio2d = cs.circle(rExt, 200).add(cs.circle(rArg, 96).translate([0, cyA])).offset(2.5, 'Round', 2, 48).offset(-2.5, 'Round', 2, 48);
  let aro = cheio2d.subtract(cs.circle(rInterno, 200)).subtract(cs.circle(rFuroArg, 64).translate([0, cyA])).extrude(alturaAro);
  // furo CÔNICO no aro = negativo do pino (boca larga -> fundo fino), + folga pra encaixar justo. Cego e fechado.
  const rPino = Math.min(p.pino / 2, rPinoMax), f = p.folgaPino;
  const compPinoRef = folga + p.penetracaoPino + 0.4;   // mesmo comprimento do pino
  // o pino entra a partir da parede interna; o furo começa lá e segue o mesmo cone + folga
  const rBocaFuro = rPino + f;                           // boca = base do pino + folga
  const rFundoFuro = rPino * 0.35 + f;                   // fundo = ponta do pino + folga
  const profFuro = Math.min(compPinoRef - folga + 0.3, p.moldura - 1.0); // só a parte que entra no aro, sem furar fora
  const furoAro = (sy) => Man.cylinder(profFuro, rBocaFuro, rFundoFuro, 28, false)  // cone: boca larga -> fundo fino
    .rotate([sy > 0 ? -90 : 90, 0, 0]).translate([0, sy * (rInterno - 0.15), zCentroDisco]);
  aro = aro.subtract(furoAro(1)).subtract(furoAro(-1));

  // ---- DISCO (arte frente/verso) com 2 pinos laterais que travam ----
  const zBase = temVerso ? espArte : 0;
  let disco = cs.circle(rDisco, 200).extrude(espBase).translate([0, 0, zBase]);
  // pino cônico com PONTA: base larga na borda do disco, afina até a ponta que entra no furo do aro.
  const compPino = folga + p.penetracaoPino + 0.4;      // cruza a folga e entra no furo
  const pino = (sy) => Man.cylinder(compPino, rPino, rPino * 0.35, 28, false)  // base larga -> ponta fina
    .rotate([sy > 0 ? -90 : 90, 0, 0]).translate([0, sy * (rDisco - 0.4), zCentroDisco]);  // pino no centro do disco
  disco = Man.union([disco, pino(1), pino(-1)]);

  const prepara = (cheio, ehVerso) => {
    const b = cheio.bounds();
    const alvo = (rDisco - p.margemArte) * 2;
    const esc = alvo / Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
    let a = cheio.scale([esc, esc]);
    const b2 = a.bounds();
    a = a.translate([-(b2.min[0] + b2.max[0]) / 2, -(b2.min[1] + b2.max[1]) / 2]);
    if (ehVerso) a = a.mirror([1, 0]);
    return a.intersect(cs.circle(rDisco - 0.3, 200));
  };

  // duas pecas: aro ao lado do disco pra imprimir separado; a arte vai no disco
  const partes3d = [['aro', aro.translate([-rExt - 3, 0, 0])], ['disco', disco.translate([rExt + 3, 0, 0])]];
  partes3d.push(['arteFrente', prepara(partes.frente.cheio, false).extrude(espArte).translate([rExt + 3, 0, zBase + espBase])]);
  if (temVerso) partes3d.push(['arteVerso', prepara(partes.verso.cheio, true).extrude(espArte).translate([rExt + 3, 0, 0])]);

  return { partes: partes3d, W: 4 * rExt + 6, H: 2 * rExt + rArg * 2, duasPecas: true, params: p };
}


// ---------------- Chaveiro abridor de garrafa (recorte funcional: gancho no topo + lingueta embaixo) ----------------
export function geoAbridorGarrafa(partes, p) {
  const cs = CS();
  const Man = M().Manifold;
  const esp = p.espessura;
  const espArte = p.espArte;
  const temVerso = !!partes.verso;
  const L = p.comprimento, H = p.altura, r = H / 2;

  // corpo base (retângulo arredondado), x de 0 a L, y centrado
  let corpo2d = retArred(L, H, r);
  const bb = corpo2d.bounds();
  corpo2d = corpo2d.translate([-bb.min[0], -(bb.min[1] + bb.max[1]) / 2]);

  // ---- RECORTE DO ABRIDOR (funcional) na metade direita ----
  // Tampa crown cap: 26-27mm. O recorte abre POR BAIXO, deixando:
  //  - uma barra no topo que termina num gancho (pega a borda de cima da tampa)
  //  - uma lingueta curta embaixo (apoia a tampa por baixo pra alavanca)
  const d = p.diamTampa;                       // diâmetro da tampa
  const xAbr = L - r - d * 0.55;               // centro do recorte, perto da direita
  const barraTopo = H * 0.30;                  // espessura da barra de cima (o gancho)
  const linguetaAlt = H * 0.16;                // altura da lingueta de baixo
  const vao = H - barraTopo - linguetaAlt;     // abertura onde a tampa entra

  // abertura principal: um rasgo que entra pela base (y de baixo) subindo até deixar a barra de topo
  const yTopoAbertura = H / 2 - barraTopo;     // a abertura vai da base até aqui
  const larguraAbertura = d * 1.15;
  const abertura = cs.square([larguraAbertura, H], true)
    .translate([xAbr, -H / 2 + (H) / 2])       // centrado
    .intersect(cs.square([larguraAbertura, H - barraTopo], false).translate([xAbr - larguraAbertura / 2, -H / 2]));
  // furo redondo (o "olho" do abridor) que dá o encaixe da tampa sob o gancho
  const olho = cs.circle(d / 2, 64).translate([xAbr, H / 2 - barraTopo - d / 2 + 2]);
  // a lingueta de baixo: reentrância que separa a lingueta do resto (um corte em L)
  const corteLingueta = cs.square([larguraAbertura * 0.6, linguetaAlt * 1.2], false)
    .translate([xAbr - larguraAbertura * 0.3, -H / 2 + linguetaAlt]);

  corpo2d = corpo2d.subtract(abertura).subtract(olho).subtract(corteLingueta);

  // ---- FURO DE PENDURAR (esquerda) ----
  const rFuroP = p.furoPendurar / 2;
  corpo2d = corpo2d.subtract(cs.circle(rFuroP, 48).translate([r + 1, 0]));

  const alturaTotal = esp + (temVerso ? espArte : 0);
  let corpo = corpo2d.extrude(alturaTotal);

  // ---- ARTE (meio-esquerda) ----
  const prepara = (cheio, ehVerso) => {
    const b = cheio.bounds();
    const alvo = Math.min(p.larguraArte, H - 2 * p.margemArte);
    const escA = alvo / Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
    let a = cheio.scale([escA, escA]);
    const b2 = a.bounds();
    const cxArte = r + rFuroP + 2 + alvo / 2 + p.posArte;
    a = a.translate([cxArte - (b2.min[0] + b2.max[0]) / 2, -(b2.min[1] + b2.max[1]) / 2]);
    if (ehVerso) a = a.mirror([1, 0]).translate([2 * cxArte, 0]);
    return a;
  };

  const zBase = temVerso ? espArte : 0;
  const partes3d = [['corpo', corpo]];
  partes3d.push(['arteFrente', prepara(partes.frente.cheio, false).extrude(espArte).translate([0, 0, zBase + esp])]);
  if (temVerso) partes3d.push(['arteVerso', prepara(partes.verso.cheio, true).extrude(espArte).translate([0, 0, 0])]);

  return { partes: partes3d, W: L, H, params: p };
}

// ---------------- Placa de PIX (placa com borda + logo + QR + nome + base de apoio) ----------------
// partes: { qr: cs, logo: cs|null, nome: cs|null, texto: cs }
// ---- Placa de PIX: layout automático (texto embaixo, nome acima, logo + QR no espaço que sobra) ----
const caber = (cs, maxW, maxH) => { const b = cs.bounds(); const e = Math.min(maxW / (b.max[0] - b.min[0]), maxH / (b.max[1] - b.min[1])); return cs.scale([e, e]); };
const topoEm = (cs, y) => { const b = cs.bounds(); return cs.translate([-(b.min[0] + b.max[0]) / 2, y - b.max[1]]); };
const fundoEm = (cs, y) => { const b = cs.bounds(); return cs.translate([-(b.min[0] + b.max[0]) / 2, y - b.min[1]]); };

export function layoutPlacaPix(partes, p) {
  const W = p.largura, H = p.altura;
  const margem = p.larguraBorda + 3;          // respiro depois da borda
  const innerW = W - 2 * margem;
  const topo = H / 2 - margem, fundo = -H / 2 + margem;
  const gap = p.espaco ?? 2.5;                // espaço entre os elementos
  const out = {};

  // de baixo pra cima: "Pagamento com PIX" e o nome
  let yLivre = fundo;
  if (partes.texto) {
    out.texto = fundoEm(caber(partes.texto, Math.min(W * 0.7, innerW), 7), yLivre);
    yLivre = out.texto.bounds().max[1] + gap;
  }
  if (partes.nome) {
    out.nome = fundoEm(caber(partes.nome, Math.min(p.tamNome, innerW), p.altNome), yLivre);
    yLivre = out.nome.bounds().max[1] + gap;
  }

  // logo em cima do QR, sem sobrepor: o QR diminui sozinho pra caber
  const logo = partes.logo ? caber(partes.logo, Math.min(p.tamLogo, innerW), p.tamLogo) : null;
  const hLogo = logo ? alt(logo) + gap : 0;
  const disp = topo - yLivre;                 // altura livre pro bloco logo + QR
  const ladoQR = Math.max(15, Math.min(p.tamQR, disp - hLogo, innerW));
  const bloco = hLogo + ladoQR;

  // bloco centralizado no espaço livre + ajuste fino (posQR), sem sair da área
  let yTopo = topo - Math.max(0, disp - bloco) / 2 + (p.posQR || 0);
  yTopo = Math.min(topo, Math.max(yLivre + bloco, yTopo));
  if (logo) out.logo = topoEm(logo, yTopo);
  out.qr = topoEm(caber(partes.qr, ladoQR, ladoQR), yTopo - hLogo);
  out.ladoQR = ladoQR;
  return out;
}

export function geoPlacaPix(partes, p) {
  const cs = CS();
  const Man = M().Manifold;
  const W = p.largura, H = p.altura, r = p.raio;
  const espBase = p.espBase, espBorda = p.espBorda, espDet = p.espDetalhe;

  // placa de fundo (retângulo arredondado)
  const placa2d = retArred(W, H, r);
  const placa = placa2d.extrude(espBase);

  // borda em relevo (moldura em volta)
  const borda2d = placa2d.subtract(retArred(W - 2 * p.larguraBorda, H - 2 * p.larguraBorda, Math.max(r - p.larguraBorda, 1)));
  const borda = borda2d.extrude(espBorda).translate([0, 0, espBase]);

  const partes3d = [['placa', placa], ['borda', borda]];

  // detalhes (logo + QR + nome + texto) numa cor só
  const L = layoutPlacaPix(partes, p);
  const dets = [L.logo, L.qr, L.nome, L.texto].filter(Boolean);
  const detalhes = Man.union(dets.map(d => d.extrude(espDet).translate([0, 0, espBase])));
  partes3d.push(['detalhes', detalhes]);

  // ---- BASE de apoio: fenda do comprimento da placa inteira + folga ----
  const espTotal = espBase + Math.max(espBorda, espDet);   // espessura real da placa
  const B = baseApoio(W, espTotal, p);
  partes3d.push(['base', B.base]);

  return { partes: partes3d, W: W + B.baseL + 10, H, params: p, ladoQR: L.ladoQR, fenda: B.fenda, espTotal };
}

// Base de apoio (placa em pé): fenda do comprimento da placa inteira + folga, ao lado da placa pra imprimir
export function baseApoio(W, espTotal, p) {
  const cs = CS();
  const folga = p.folgaBase;                               // folga de cada lado
  const parede = 3, piso = 3;
  const fendaL = W + 2 * folga, fendaE = espTotal + 2 * folga;
  const baseL = fendaL + 2 * parede;
  const baseP = Math.max(p.profBase, fendaE + 12);
  const baseH = Math.max(p.altBase, piso + 5);
  const fenda = cs.square([fendaL, fendaE], true).extrude(baseH).translate([0, 0, piso]);
  const base = retArred(baseL, baseP, 3).extrude(baseH).subtract(fenda);
  return { base: base.translate([W / 2 + baseL / 2 + 8, 0, 0]), baseL, fenda: { L: fendaL, E: fendaE, prof: baseH - piso } };
}

// ---------------- Placa de avaliação (Google) com QR + NFC embutido ----------------
const poli = pts => new (CS())([pts], 'NonZero');
function estrela(r) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([rr * Math.cos(a), rr * Math.sin(a)]); }
  return poli(pts);
}
function arco(cx, cy, r, e, a0, a1, n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + (r + e / 2) * Math.cos(a), cy + (r + e / 2) * Math.sin(a)]); }
  for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + (r - e / 2) * Math.cos(a), cy + (r - e / 2) * Math.sin(a)]); }
  return poli(pts);
}
const anel = (r, e) => CS().circle(r + e / 2, 96).subtract(CS().circle(r - e / 2, 96));
const centroEm = (cs, x, y) => { const b = cs.bounds(); return cs.translate([x - (b.min[0] + b.max[0]) / 2, y - (b.min[1] + b.max[1]) / 2]); };
const topoEmX = (cs, x, y) => { const b = cs.bounds(); return cs.translate([x - (b.min[0] + b.max[0]) / 2, y - b.max[1]]); };
const fundoEmX = (cs, x, y) => { const b = cs.bounds(); return cs.translate([x - (b.min[0] + b.max[0]) / 2, y - b.min[1]]); };
const uniao = l => { const v = l.filter(Boolean); return v.length ? CS().union(v) : null; };

// partes (2D, cru): qr, logo?, titulo1?, titulo2?, rotuloNFC, rotuloQR, codigo?, rodape?, nfcTxt
// devolve as formas 2D já posicionadas, agrupadas por cor + centro do NFC
export function layoutPlacaAvaliacao(partes, p) {
  const W = p.largura, H = p.altura, lb = p.larguraBorda;
  const m = lb + 3, innerW = W - 2 * m;
  const topo = H / 2 - m, fundo = -H / 2 + m, gap = p.espaco;

  // ---------- faixa de cima: estrelas + título ----------
  const estrelas = [];
  let y = topo;
  if (p.nEstrelas > 0) {
    const s = p.tamEstrela, passo = s * 1.35;
    const x0 = -(p.nEstrelas - 1) * passo / 2;
    for (let i = 0; i < p.nEstrelas; i++) estrelas.push(centroEm(estrela(s / 2), x0 + i * passo, y - s / 2));
    y -= s + gap;
  }
  const titulos = [];
  for (const t of [partes.titulo1, partes.titulo2]) {
    if (!t) continue;
    const c = topoEm(caber(t, innerW, p.altTitulo), y);
    titulos.push(c); y = c.bounds().min[1] - gap * 0.6;
  }
  const rLogo = partes.logo ? p.tamLogo / 2 : 0;
  const amp = p.onda;
  const yOnda = y - gap * 0.4 - Math.max(rLogo, amp);

  // onda: borda de baixo da faixa
  const pts = [];
  for (let x = -W / 2 - 1; x <= W / 2 + 1.001; x += 1) pts.push([x, yOnda + amp * Math.sin(2 * Math.PI * x / W)]);
  pts.push([W / 2 + 1, H / 2 + 1], [-W / 2 - 1, H / 2 + 1]);
  const interno = retArred(W - 2 * lb, H - 2 * lb, Math.max(p.raio - lb, 1));
  let faixa = interno.intersect(poli(pts));

  // logo num círculo claro, em cima da onda
  let disco = null, logo = null;
  if (partes.logo) {
    disco = CS().circle(rLogo, 96).translate([0, yOnda]);
    faixa = faixa.subtract(disco);
    logo = centroEm(caber(partes.logo, p.tamLogo * 0.68, p.tamLogo * 0.68), 0, yOnda);
  }

  // ---------- parte de baixo: NFC (esq.) | QR (dir.) ----------
  const det = [];
  let yBaixo = fundo;
  if (partes.rodape) {
    const r = fundoEm(caber(partes.rodape, innerW * 0.92, p.altRotulo), yBaixo);
    det.push(r); yBaixo = r.bounds().max[1] + gap * 1.5;
  }
  const yCima = yOnda - Math.max(rLogo, amp) - gap * 1.5;
  if (yCima - yBaixo < 25) throw new Error('Não sobrou espaço pro NFC e o QR. Aumente a altura da placa ou diminua título/logo.');

  const gapCol = 5, colW = (innerW - gapCol) / 2;
  const xL = -(gapCol / 2 + colW / 2), xR = gapCol / 2 + colW / 2;
  det.push(CS().square([0.8, (yCima - yBaixo) * 0.8], true).translate([0, (yCima + yBaixo) / 2])); // divisória

  // coluna NFC
  let yTopoNfc = yCima;
  if (partes.rotuloNFC) { const r = topoEmX(caber(partes.rotuloNFC, colW, p.altRotulo), xL, yCima); det.push(r); yTopoNfc = r.bounds().min[1] - gap; }
  const R = p.diamNFC / 2 + p.folgaNFC + 1.5;              // anel desenhado em volta da tag
  if (2 * R + 1.2 > colW) throw new Error('A tag NFC não cabe na coluna. Aumente a largura da placa ou use uma tag menor.');
  if (2 * R + 1.2 > yTopoNfc - yBaixo) throw new Error('A tag NFC não cabe na altura. Aumente a altura da placa.');
  const cyN = (yTopoNfc + yBaixo) / 2;
  det.push(anel(R, 1.2).translate([xL, cyN]));
  const cA = cyN - R * 0.12;                                 // centro das ondinhas do símbolo
  for (const k of [0.24, 0.42, 0.6]) det.push(arco(xL, cA, R * k, Math.max(0.9, R * 0.07), Math.PI * 0.27, Math.PI * 0.73));
  det.push(CS().circle(R * 0.075, 32).translate([xL, cA]));
  if (partes.nfcTxt) det.push(topoEmX(caber(partes.nfcTxt, R * 1.1, R * 0.26), xL, cA - R * 0.18));

  // coluna QR
  let yTopoQR = yCima, yFundoQR = yBaixo;
  if (partes.rotuloQR) { const r = topoEmX(caber(partes.rotuloQR, colW, p.altRotulo), xR, yCima); det.push(r); yTopoQR = r.bounds().min[1] - gap; }
  if (partes.codigo) { const r = fundoEmX(caber(partes.codigo, colW * 0.8, p.altRotulo * 0.85), xR, yBaixo); det.push(r); yFundoQR = r.bounds().max[1] + gap; }
  const ladoQR = Math.max(12, Math.min(p.tamQR, colW, yTopoQR - yFundoQR));
  det.push(centroEm(caber(partes.qr, ladoQR, ladoQR), xR, (yTopoQR + yFundoQR) / 2));

  return {
    faixa, disco, logo, estrelas: uniao(estrelas), titulos: uniao(titulos), detalhes: uniao(det),
    nfc: { x: xL, y: cyN }, ladoQR, interno,
  };
}

export function geoPlacaAvaliacao(partes, p) {
  const Man = M().Manifold;
  const W = p.largura, H = p.altura, r = p.raio;
  const eB = p.espBase, eF = p.espFaixa, eD = p.espDetalhe;
  const L = layoutPlacaAvaliacao(partes, p);

  // ---- bolsão da tag NFC alinhado às camadas, com pausa ----
  const h1 = p.primeiraCamada, lh = p.alturaCamada;
  const kTopo = Math.round((eB - p.cobertura - h1) / lh);
  const zTopo = +(h1 + kTopo * lh).toFixed(3);                 // topo do bolsão = topo de uma camada
  const prof = Math.ceil((p.espNFC + 0.15) / lh - 1e-6) * lh;  // tag + respiro, em camadas inteiras
  const zFundo = +(zTopo - prof).toFixed(3);
  if (zFundo < h1 + lh - 1e-6) throw new Error('Placa fina demais pro NFC. Aumente a espessura da placa ou diminua a cobertura.');
  const dFuro = p.diamNFC + 2 * p.folgaNFC;
  const furo = M().CrossSection.circle(dFuro / 2, 96).extrude(prof).translate([L.nfc.x, L.nfc.y, zFundo]);

  const placa2d = retArred(W, H, r);
  const placa = placa2d.extrude(eB).subtract(furo);
  const borda = placa2d.subtract(L.interno).extrude(p.espBorda).translate([0, 0, eB]);
  const faixa = L.faixa.extrude(eF).translate([0, 0, eB]);
  const claros = Man.union([
    L.disco && L.disco.extrude(eF).translate([0, 0, eB]),
    L.titulos && L.titulos.extrude(eD).translate([0, 0, eB + eF]),
  ].filter(Boolean));
  const partes3d = [['placa', placa], ['borda', borda], ['faixa', faixa]];
  if (L.titulos || L.disco) partes3d.push(['claros', claros]);
  if (L.estrelas) partes3d.push(['estrelas', L.estrelas.extrude(eD).translate([0, 0, eB + eF])]);
  if (L.logo) partes3d.push(['logo', L.logo.extrude(eD).translate([0, 0, eB + eF])]);
  partes3d.push(['detalhes', L.detalhes.extrude(eD).translate([0, 0, eB])]);

  const espTotal = eB + Math.max(p.espBorda, eF + eD, eD);
  const B = baseApoio(W, espTotal, p);
  partes3d.push(['base', B.base]);

  const zPausa = +(zTopo + lh).toFixed(2);                     // pausa ANTES da camada que fecha o bolsão
  return {
    partes: partes3d, W: W + B.baseL + 10, H, params: p, espTotal, fenda: B.fenda, ladoQR: L.ladoQR,
    nfc: { zFundo, zTopo, prof, dFuro, zPausa, camada: kTopo + 2 },
  };
}

// ---------------- Placa de sinalização (painel com arte vazada + texto) ----------------
// retângulo com raio próprio em cada canto: [supEsq, supDir, infDir, infEsq]
export function retCantos(w, h, [rTL, rTR, rBR, rBL], n = 40) {
  const lim = r => Math.max(0, Math.min(r || 0, w / 2 - 0.01, h / 2 - 0.01));
  const pts = [];
  const canto = (cx, cy, r, a0) => {
    if (r <= 0) { pts.push([cx, cy]); return; }
    for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI / 2) * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  };
  const [a, b, c, d] = [rTL, rTR, rBR, rBL].map(lim);
  canto(-w / 2 + d, -h / 2 + d, d, Math.PI);          // inferior esquerdo
  canto(w / 2 - c, -h / 2 + c, c, Math.PI * 1.5);     // inferior direito
  canto(w / 2 - b, h / 2 - b, b, 0);                  // superior direito
  canto(-w / 2 + a, h / 2 - a, a, Math.PI / 2);       // superior esquerdo
  return new (CS())([pts], 'NonZero');
}

// partes: { texto: cs|null, arte: cs|null }  ->  formas 2D posicionadas
export function layoutPlacaSinal(partes, p) {
  const W = p.largura, H = p.altura, m = p.margem;
  const placa = retCantos(W, H, [p.rReto, p.rSupDir, p.rReto, p.rInfEsq]);
  // painel: placa encolhida pela margem, só a parte da esquerda (até a largura do painel)
  const encolhida = placa.offset(-m, 'Miter', 2);
  const xPainelDir = -W / 2 + m + p.larguraPainel;
  const corte = CS().square([p.larguraPainel + 2, H + 2], true).translate([-W / 2 + m + p.larguraPainel / 2 - 1, 0]);
  const painelCheio = encolhida.intersect(corte);
  const cxP = (-W / 2 + m + xPainelDir) / 2;

  let arte = null;
  if (partes.arte) {
    arte = partes.arte;
    const b = arte.bounds();
    const e = p.larguraArte / Math.max(b.max[0] - b.min[0], 1e-6);
    arte = arte.scale([e, e]);
    const b2 = arte.bounds();
    arte = arte.translate([-(b2.min[0] + b2.max[0]) / 2, -(b2.min[1] + b2.max[1]) / 2]);
    if (p.rotArte) arte = arte.rotate(p.rotArte);
    arte = arte.translate([cxP + p.arteX, p.arteY]).intersect(painelCheio.offset(-0.8, 'Round', 2, 32)); // não deixa a arte vazar a borda do painel
  }
  const painel = arte ? painelCheio.subtract(arte) : painelCheio;

  // texto: centralizado na área à direita do painel
  let texto = null;
  if (partes.texto) {
    const x0 = xPainelDir + p.espacoTexto, x1 = W / 2 - m;
    const areaW = Math.max(10, x1 - x0) * 0.8;
    texto = caber(partes.texto, areaW, p.altTexto);
    const b = texto.bounds();
    texto = texto.translate([(x0 + x1) / 2 + p.textoX - (b.min[0] + b.max[0]) / 2, p.textoY - (b.min[1] + b.max[1]) / 2]);
  }
  return { placa, painel, painelCheio, arte, texto, centroPainel: [cxP, 0] };
}

export function geoPlacaSinal(partes, p) {
  const L = layoutPlacaSinal(partes, p);
  const eB = p.espBase, af = Math.min(p.afundar, eB - 0.6);
  // base inteira, com um rebaixo onde o painel encaixa (onde a arte vaza, a base fica cheia)
  let base = L.placa.extrude(eB);
  if (af > 0) base = base.subtract(L.painel.extrude(af + 0.01).translate([0, 0, eB - af]));
  const painel = L.painel.extrude(af + p.relevoPainel).translate([0, 0, eB - af]);
  const partes3d = [['placa', base], ['painel', painel]];
  if (L.texto) partes3d.push(['texto', L.texto.extrude(p.relevoTexto).translate([0, 0, eB])]);
  return { partes: partes3d, espTotal: eB + Math.max(p.relevoPainel, p.relevoTexto) };
}

// ---------------- Medalha (aro serrilhado + alça de fita + arte no centro) ----------------
// partes: { arte: cs|null }
export function layoutMedalha(partes, p) {
  const R = p.diametro / 2, rC = R - p.larguraAro - p.sulco;   // raio da face central
  const C = CS();
  const disco = C.circle(R, 180);
  // alça com o rasgo da fita, em cima do disco
  const wA = p.larguraFita + 2 * p.paredeAlca, topoA = R + p.alturaFita + p.paredeAlca;
  const alca = retCantos(wA, topoA, [1.5, 1.5, 0, 0]).translate([0, topoA / 2]);
  const rasgo = C.square([p.larguraFita, p.alturaFita + R], true).translate([0, R + p.alturaFita - (p.alturaFita + R) / 2]).subtract(disco);
  const contorno = disco.add(alca).subtract(rasgo);
  const face = C.circle(rC, 160);

  let arte = null;
  if (partes.arte) {
    arte = caber(partes.arte, p.tamArte, p.tamArte);
    const b = arte.bounds();
    arte = arte.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]);
    if (p.rotArte) arte = arte.rotate(p.rotArte);
    arte = arte.translate([p.arteX, p.arteY]).intersect(face.offset(-0.8, 'Round', 2, 64));
  }
  return { R, rC, disco, alca, contorno, face, arte };
}

// remove pedacinhos soltos de volume ~0 que sobram de booleanas em bordas coincidentes
// (bolsões fechados por dentro viram uma "casca" de volume negativo no decompose: são mantidos)
function semLascas(m) {
  const todas = m.decompose();
  const boas = todas.filter(x => Math.abs(x.volume()) > 0.01);
  if (boas.length === todas.length) return m;
  return boas.length === 1 ? boas[0] : M().Manifold.compose(boas);
}

export function geoMedalha(partes, p) {
  const Man = M().Manifold, C = CS();
  const L = layoutMedalha(partes, p);
  const R = L.R, hT = p.espessura, hA = hT - p.alturaSerrilha;   // topo e "vale" do aro
  const ch = Math.min(p.chanfro, 1);

  // corpo: disco até o vale do aro + alça mais fina; 1ª camada recuada (chanfro anti pé-de-elefante)
  const camadas = (cs2d, h) => ch > 0
    ? Man.union([cs2d.offset(-ch, 'Round', 2, 64).extrude(ch), cs2d.extrude(h - ch).translate([0, 0, ch])])
    : cs2d.extrude(h);
  let corpo = Man.union([camadas(L.disco, hA), camadas(L.contorno.subtract(C.circle(R - 4, 180)), Math.min(p.espAlca, hA))]);

  // face central lisa, na altura do topo
  corpo = corpo.add(L.face.extrude(hT));

  // aro: serrilha (raios em relevo) ou liso
  const r0 = L.rC + p.sulco, r1 = R - 0.4;
  if (p.serrilha && p.nRaios > 0 && p.alturaSerrilha > 0) {
    const raios = [];
    const passo = 2 * Math.PI / p.nRaios;
    const meiaBase = passo * 0.47, meioTopo = passo * 0.1;
    for (let i = 0; i < p.nRaios; i++) {
      const a = i * passo + Math.PI / 2, pts = [];
      for (const [da, z] of [[meiaBase, hA - 0.01], [meioTopo, hT]]) {
        for (const s of [-1, 1]) for (const r of [r0, r1]) pts.push([r * Math.cos(a + s * da), r * Math.sin(a + s * da), z]);
      }
      raios.push(Man.hull(pts));
    }
    corpo = corpo.add(Man.union(raios));
  } else {
    corpo = corpo.add(C.circle(r1, 180).subtract(C.circle(r0, 160)).extrude(p.alturaSerrilha).translate([0, 0, hA - 0.01]));
  }

  corpo = semLascas(corpo);
  const partes3d = [];
  if (L.arte) {
    if (p.modoArte === 'relevo') {
      partes3d.push(['medalha', corpo], ['arte', L.arte.extrude(p.relevoArte).translate([0, 0, hT])]);
    } else {
      const fundo = Math.min(p.relevoArte, hT - 1);
      const bolso = L.arte.extrude(fundo + 0.01).translate([0, 0, hT - fundo]);
      corpo = corpo.subtract(bolso);
      partes3d.push(['medalha', corpo]);
      if (p.modoArte === 'embutido') partes3d.push(['arte', L.arte.extrude(fundo).translate([0, 0, hT - fundo])]);
    }
  } else partes3d.push(['medalha', corpo]);
  return { partes: partes3d, alturaTotal: hT + (L.arte && p.modoArte === 'relevo' ? p.relevoArte : 0), altura: R + L.alca.bounds().max[1] - R };
}

// ---------------- Medalha com a FORMA da arte (contorno do SVG + borda + alça) ----------------
const areaAnel = q => { let a = 0; for (let i = 0, j = q.length - 1; i < q.length; j = i++) a += (q[j][0] + q[i][0]) * (q[j][1] - q[i][1]); return Math.abs(a / 2); };
// tapa os buracos: de cada pedaço fica só o anel externo (o de maior área)
export function preencherBuracos(cs) {
  const cheios = [];
  for (const comp of cs.decompose()) {
    const aneis = comp.toPolygons();
    if (!aneis.length) continue;
    let melhor = aneis[0];
    for (const q of aneis) if (areaAnel(q) > areaAnel(melhor)) melhor = q;
    cheios.push(poli(melhor));
  }
  return cheios.length ? CS().union(cheios) : cs;
}

// partes: { arte: cs }   (arte crua do SVG/PNG)
export function layoutMedalhaForma(partes, p) {
  const C = CS();
  // arte na largura pedida, centralizada
  let arte = partes.arte;
  const b0 = arte.bounds();
  arte = arte.scale([p.larguraArte / (b0.max[0] - b0.min[0]), p.larguraArte / (b0.max[0] - b0.min[0])]);
  const b1 = arte.bounds();
  arte = arte.translate([-(b1.min[0] + b1.max[0]) / 2, -(b1.min[1] + b1.max[1]) / 2]);

  // silhueta: junta pedacinhos próximos (fechamento), tapa os buracos e soma a borda
  const fechar = (cs, r) => r > 0 ? preencherBuracos(cs.offset(r, 'Round', 2, 48)).offset(-r, 'Round', 2, 48) : cs;
  let fecho = p.fecho;
  let corpo = preencherBuracos(fechar(preencherBuracos(arte), fecho).offset(p.borda, 'Round', 2, 64));
  // se ainda ficou em pedaços soltos, aumenta o fechamento até virar uma peça só
  while (corpo.decompose().length > 1 && fecho < 30) {
    fecho += 2;
    corpo = preencherBuracos(fechar(preencherBuracos(arte), fecho).offset(p.borda, 'Round', 2, 64));
  }
  const fechoUsado = fecho;

  // alça: argola com rasgo da fita + "pescoço" que sai do topo do contorno
  const bb = corpo.bounds();
  const sonda = corpo.intersect(C.square([2, bb.max[1] - bb.min[1] + 2], true).translate([0, (bb.min[1] + bb.max[1]) / 2]));
  const yCentro = sonda.isEmpty() ? bb.max[1] : sonda.bounds().max[1];   // topo do contorno no meio
  const wA = p.larguraFita + 2 * p.paredeAlca, hA = p.alturaFita + 2 * p.paredeAlca;
  const yArgola = Math.max(yCentro + p.pescoco, bb.max[1] + 1);            // base da argola
  const argola = retCantos(wA, hA, [2, 2, 2, 2]).translate([0, yArgola + hA / 2]);
  const rasgo = retCantos(p.larguraFita, p.alturaFita, [0.8, 0.8, 0.8, 0.8]).translate([0, yArgola + hA / 2]);
  const yBaixo = yCentro - Math.max(4, p.borda + 1);
  const pescoco = poli([[-wA * 0.8, yBaixo], [wA * 0.8, yBaixo], [wA * 0.42, yArgola + 0.5], [-wA * 0.42, yArgola + 0.5]]);
  const alca = argola.add(pescoco).subtract(corpo).subtract(rasgo);
  const contorno = corpo.add(alca).subtract(rasgo);

  return { arte, corpo, alca, contorno, rasgo, fechoUsado, larg: bb.max[0] - bb.min[0], alt: yArgola + hA - bb.min[1] };
}

export function geoMedalhaForma(partes, p) {
  const Man = M().Manifold;
  const L = layoutMedalhaForma(partes, p);
  const eB = p.espBase, ch = Math.min(p.chanfro, 1);
  const camadas = (cs2d, h) => ch > 0
    ? Man.union([cs2d.offset(-ch, 'Round', 2, 48).extrude(ch), cs2d.extrude(h - ch).translate([0, 0, ch])])
    : cs2d.extrude(h);
  // corpo na espessura da base; alça mais fina (sobrepõe 1 mm no corpo pra ficar colada)
  let medalha = Man.union([camadas(L.corpo, eB), camadas(L.alca.add(L.corpo.intersect(L.alca.offset(1, 'Round', 2, 32))), Math.min(p.espAlca, eB))]);
  let arte;
  if (p.acabamento === 'rente') {
    const prof = Math.min(p.relevo, eB - 1);
    medalha = medalha.subtract(L.arte.extrude(prof + 0.01).translate([0, 0, eB - prof]));
    arte = L.arte.extrude(prof).translate([0, 0, eB - prof]);
  } else {
    arte = L.arte.extrude(p.relevo).translate([0, 0, eB]);
  }
  medalha = semLascas(medalha);
  return {
    partes: [['medalha', medalha], ['arte', arte]],
    alturaTotal: eB + (p.acabamento === 'rente' ? 0 : p.relevo), larg: L.larg, alt: L.alt, fechoUsado: L.fechoUsado,
  };
}

// ---------------- Troféu: disco com arte + 3 hastes (peça chapada) encaixada numa base com texto ----------------
// faixa curva: linha central (x0,0) -> (x1,yTopo) abrindo pra fora, largura afinando até virar ponta
function laminaCurva(x0, x1, yTopo, w0, w1, n = 48) {
  const esq = [], dir = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t * t, y = yTopo * t;
    const dx = 2 * (x1 - x0) * t, dy = yTopo;               // derivada da curva
    const L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;  // normal
    const w = (w0 + (w1 - w0) * Math.pow(t, 1.6)) / 2;
    esq.push([x + nx * w, y + ny * w]); dir.push([x - nx * w, y - ny * w]);
  }
  // ponta afiada: um ponto à frente, na direção da curva
  const tx = 2 * (x1 - x0), ty = yTopo, tl = Math.hypot(tx, ty);
  const ponta = [x1 + tx / tl * w1 * 1.6, yTopo + ty / tl * w1 * 1.6];
  return poli([...dir, ponta, ...esq.reverse()]);
}

// partes: { arte?: cs, linha1?: cs, linha2?: cs }   -> vista de frente (x, altura), origem no topo do pedestal
export function layoutTrofeu(partes, p) {
  const C = CS();
  const R = p.diametroDisco / 2, wH = p.larguraHaste;
  const yDisco = p.alturaHastes + R;                          // centro do disco
  const xLat = wH + p.espacoHastes;                           // centro das hastes laterais embaixo
  const disco = C.circle(R, 160).translate([0, yDisco]);
  const central = C.square([wH, yDisco], false).translate([-wH / 2, 0]);
  const yPonta = yDisco - R * (1 - p.alturaPontas);           // onde as laterais terminam
  const lat = [-1, 1].map(s => laminaCurva(s * xLat, s * (R + p.aberturaPontas), yPonta, wH, wH * 0.6));
  const wEnc = 2 * (xLat + wH / 2);
  const encaixe = C.square([wEnc, p.profEncaixe + 0.5], false).translate([-wEnc / 2, -p.profEncaixe]);
  const figura = C.union([disco, central, ...lat, encaixe]);

  let arte = null;
  if (partes.arte) {
    arte = caber(partes.arte, p.tamArte, p.tamArte);
    const b = arte.bounds();
    arte = arte.translate([-(b.min[0] + b.max[0]) / 2, yDisco + p.arteY - (b.min[1] + b.max[1]) / 2])
      .intersect(C.circle(R - 1.2, 160).translate([0, yDisco]));
  }

  // base vista de frente: de -hPed-H até -hPed; textos centralizados nela
  const W = p.larguraBase, H = p.alturaBase, hP = p.alturaPedestal;
  const linhas = [partes.linha1 && caber(partes.linha1, W - 2 * p.margemTexto, p.altLinha1),
                  partes.linha2 && caber(partes.linha2, W - 2 * p.margemTexto, p.altLinha2)].filter(Boolean);
  const gap = 1.6;
  const hTot = linhas.reduce((a, l) => a + alt(l), 0) + gap * Math.max(0, linhas.length - 1);
  let y = -hP - H / 2 + hTot / 2 + p.textoY;
  const textos = linhas.map(l => { const t = topoEm(l, y); y = t.bounds().min[1] - gap; return t; });
  const texto = textos.length ? C.union(textos) : null;

  return { figura, disco, arte, texto, wEnc, yDisco, R, alturaFigura: yDisco + R, larguraFigura: Math.max(2 * R, 2 * (R + p.aberturaPontas) + 2) };
}

export function geoTrofeu(partes, p) {
  const Man = M().Manifold, C = CS();
  const L = layoutTrofeu(partes, p);
  const W = p.larguraBase, D = p.profBase, H = p.alturaBase, hP = p.alturaPedestal, e = p.espessura, f = p.folga;

  // ---- BASE (em pé, como vai ficar) ----
  const rasgo = C.square([L.wEnc + 2 * f, e + 2 * f], true).extrude(p.profEncaixe + 1).translate([0, 0, H + hP - p.profEncaixe - 0.5]);
  const base = retArred(W, D, p.raioBase).extrude(H).subtract(rasgo);
  const pedestal = C.circle(p.diametroPedestal / 2, 120).extrude(hP).translate([0, 0, H]).subtract(rasgo);
  const partesBase = [['base', base], ['pedestal', pedestal]];
  if (L.texto) {
    // texto da vista de frente (x, altura) -> face da frente da base (y = -D/2), saltado pra fora
    const t = L.texto.translate([0, hP + H]).extrude(p.relevoTexto).rotate([90, 0, 0]).translate([0, -D / 2, 0]);
    partesBase.push(['texto', t]);
  }

  // ---- FIGURA (disco + hastes) deitada, arte pra cima ----
  let figura = L.figura.extrude(e);
  let arte = null;
  if (L.arte) {
    if (p.acabamento === 'rente') {
      const pr = Math.min(p.relevoArte, e - 1.5);
      figura = figura.subtract(L.arte.extrude(pr + 0.01).translate([0, 0, e - pr]));
      arte = L.arte.extrude(pr).translate([0, 0, e - pr]);
    } else arte = L.arte.extrude(p.relevoArte).translate([0, 0, e]);
  }
  // posição na mesa: figura ao lado da base, centralizada
  const fb = figura.boundingBox();
  const dx = W / 2 + 10 - fb.min[0], dy = -(fb.min[1] + fb.max[1]) / 2;
  const imprimir = [...partesBase, ['figura', figura.translate([dx, dy, 0])]];
  if (arte) imprimir.push(['arte', arte.translate([dx, dy, 0])]);

  // montado: figura em pé dentro do rasgo (plano XZ, espessura centrada em Y)
  const emPe = m => m.translate([0, 0, -e / 2]).rotate([90, 0, 0]).translate([0, 0, H + hP]);
  const montado = [...partesBase, ['figura', emPe(figura)]];
  if (arte) montado.push(['arte', emPe(arte)]);

  return { partes: imprimir, montado, alturaTotal: H + hP + L.alturaFigura, L };
}

// ---------------- Chaveiro de nome (contorno do texto + argola) ----------------
// partes: { texto: cs, arte?: cs }
export function layoutChaveiroNome(partes, p) {
  const C = CS();
  // texto na altura pedida (altura da letra maiúscula ~ altura total do bloco), engrossado se pedir
  let texto = partes.texto;
  const bt = texto.bounds(), e = p.alturaTexto / (bt.max[1] - bt.min[1]);
  texto = texto.scale([e, e]);
  if (p.engrossar > 0) texto = texto.offset(p.engrossar, 'Round', 2, 32);
  const b2 = texto.bounds();
  texto = texto.translate([-(b2.min[0] + b2.max[0]) / 2, -(b2.min[1] + b2.max[1]) / 2]);

  // arte opcional ao lado do nome
  let arte = null;
  if (partes.arte) {
    arte = caber(partes.arte, p.tamArte, p.tamArte);
    const ba = arte.bounds(), bt3 = texto.bounds();
    const w = ba.max[0] - ba.min[0];
    const x = p.ladoArte === 'direita' ? bt3.max[0] + p.espacoArte + w / 2 : bt3.min[0] - p.espacoArte - w / 2;
    arte = arte.translate([x - (ba.min[0] + ba.max[0]) / 2, p.arteY - (ba.min[1] + ba.max[1]) / 2]);
  }
  const tudo = arte ? texto.add(arte) : texto;

  // base: contorno de tudo + borda, juntando letras e tapando os buracos
  const fechar = (cs, r) => r > 0 ? preencherBuracos(cs.offset(r, 'Round', 2, 40)).offset(-r, 'Round', 2, 40) : cs;
  let fecho = p.fecho, base;
  const montarBase = f => preencherBuracos(fechar(tudo, f).offset(p.borda, 'Round', 2, 48));
  base = montarBase(fecho);
  while (base.decompose().length > 1 && fecho < 20) { fecho += 1; base = montarBase(fecho); }

  // argola: no lado escolhido, na altura do meio da ponta do contorno
  const bb = base.bounds();
  const esq = p.ladoArgola !== 'direita';
  const xBorda = esq ? bb.min[0] : bb.max[0];
  const faixa = base.intersect(C.square([3, bb.max[1] - bb.min[1] + 2], true)
    .translate([xBorda + (esq ? 1.5 : -1.5), (bb.min[1] + bb.max[1]) / 2]));
  const yArg = (faixa.isEmpty() ? (bb.min[1] + bb.max[1]) / 2 : (faixa.bounds().min[1] + faixa.bounds().max[1]) / 2) + p.argolaY;
  const rExt = p.furo / 2 + p.paredeArgola;
  const xArg = xBorda + (esq ? -1 : 1) * (rExt - p.sobreposicao);
  const furo = C.circle(p.furo / 2, 64).translate([xArg, yArg]);
  const argola = C.circle(rExt, 64).translate([xArg, yArg]);
  base = base.add(argola).subtract(furo);
  // o texto/arte nunca cobre o furo
  const livre = C.circle(p.furo / 2 + 0.6, 64).translate([xArg, yArg]);
  texto = texto.subtract(livre);
  if (arte) arte = arte.subtract(livre);

  const bf = base.bounds();
  return { base, texto, arte, fechoUsado: fecho, larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1] };
}

export function geoChaveiroNome(partes, p) {
  const Man = M().Manifold;
  const L = layoutChaveiroNome(partes, p);
  const eB = p.espBase, ch = Math.min(p.chanfro, 0.8);
  let base = ch > 0
    ? Man.union([L.base.offset(-ch, 'Round', 2, 40).extrude(ch), L.base.extrude(eB - ch).translate([0, 0, ch])])
    : L.base.extrude(eB);
  const pecas = [];
  const colocar = (cs, id) => {
    if (!cs || cs.isEmpty()) return;
    if (p.acabamento === 'rente') {
      const pr = Math.min(p.relevo, eB - 0.8);
      base = base.subtract(cs.extrude(pr + 0.01).translate([0, 0, eB - pr]));
      pecas.push([id, cs.extrude(pr).translate([0, 0, eB - pr])]);
    } else pecas.push([id, cs.extrude(p.relevo).translate([0, 0, eB])]);
  };
  colocar(L.texto, 'texto');
  colocar(L.arte, 'arte');
  return { partes: [['base', semLascas(base)], ...pecas], larg: L.larg, alt: L.alt, fechoUsado: L.fechoUsado,
    alturaTotal: eB + (p.acabamento === 'rente' ? 0 : p.relevo) };
}

// ---------------- Chaveiro articulado (dobradiça horizontal impressa no lugar entre as letras) ----------------
// glifos: [cs | null(espaço)] já em mm, na linha de base y=0
// Junta entre A (esq.) e B (dir.): eixo HORIZONTAL ao longo de Y, em x = xj, z = Rk (altura do meio do bloco)
//   A: "língua" no meio (cilindro raio Rk) com furo pro pino (folga c)
//   B: dois "garfos" nas pontas (cilindros raio Rk) + pino ligando os dois, atravessando a língua
//   Folga axial ga entre língua e garfos; cada peça é recortada no cilindro (Rk + c) da outra.
export function juntaArticulada(p) {
  const rp = p.pino / 2, c = p.folgaRadial, ga = p.folgaAxial;
  const Rk = rp + c + p.paredeJunta;               // raio dos cilindros da dobradiça
  const W = p.larguraJunta;                         // comprimento total da dobradiça (em Y)
  const Lm = Math.max(2, (W - 2 * ga) * p.fracaoLingua); // língua no meio
  return { rp, c, ga, Rk, W, Lm, hB: 2 * Rk };
}

export function layoutChaveiroArticulado(glifos, p) {
  const C = CS();
  const J = juntaArticulada(p);
  const fechar = (cs, r) => r > 0 ? preencherBuracos(cs.offset(r, 'Round', 2, 32)).offset(-r, 'Round', 2, 32) : cs;
  // espaço mínimo: a letra não pode ficar em cima do cilindro da junta
  const gap = Math.max(p.espaco, 2 * (J.Rk + J.c + 0.3 - p.borda), 2 * J.c + 0.4);
  const pecas = [];
  let x = 0, pendente = 0;
  for (const g0 of glifos) {
    if (!g0) { pendente += p.larguraEspaco; continue; }
    let letra = p.engrossar > 0 ? g0.offset(p.engrossar, 'Round', 2, 24) : g0;
    let bloco = preencherBuracos(fechar(letra, p.fecho).offset(p.borda, 'Round', 2, 40));
    if (bloco.decompose().length > 1) bloco = preencherBuracos(fechar(letra, p.fecho + 3).offset(p.borda, 'Round', 2, 40));
    const b = bloco.bounds();
    const dx = (pecas.length ? x + gap + pendente : 0) - b.min[0];
    letra = letra.translate([dx, 0]); bloco = bloco.translate([dx, 0]);
    pecas.push({ letra, bloco, bb: bloco.bounds() });
    x = pecas[pecas.length - 1].bb.max[0]; pendente = 0;
  }
  if (!pecas.length) throw new Error('Digite o nome.');

  const juntas = [];
  for (let i = 0; i + 1 < pecas.length; i++) {
    const A = pecas[i].bb, B = pecas[i + 1].bb;
    const xj = (A.max[0] + B.min[0]) / 2;
    const y0 = Math.max(A.min[1], B.min[1]), y1 = Math.min(A.max[1], B.max[1]);
    const W = Math.min(J.W, Math.max(6, y1 - y0 - 1));
    const yc = (y0 + y1) / 2 + p.juntaY;
    const Lm = Math.max(2, (W - 2 * J.ga) * p.fracaoLingua);
    const cxA = (A.min[0] + A.max[0]) / 2, cxB = (B.min[0] + B.max[0]) / 2;
    juntas.push({ i, xj, yc, W, Lm, cxA, cxB });
  }

  const P0 = pecas[0], rExt = p.furo / 2 + p.paredeArgola;
  const yArg = (P0.bb.min[1] + P0.bb.max[1]) / 2 + p.argolaY;
  const xArg = P0.bb.min[0] - rExt + p.sobreposicao;
  const argola = { externo: C.circle(rExt, 64).translate([xArg, yArg]), furo: C.circle(p.furo / 2, 64).translate([xArg, yArg]) };
  return { pecas, juntas, argola, J, gap };
}

export function geoChaveiroArticulado(glifos, p) {
  const Man = M().Manifold;
  const L = layoutChaveiroArticulado(glifos, p);
  const J = L.J, hB = J.hB, topo = hB + p.relevo, zc = J.Rk;
  const fatia = (cs, z0, z1) => cs.extrude(z1 - z0).translate([0, 0, z0]);
  // cilindro deitado ao longo de Y, de y0 a y1, eixo em (x, zc)
  const cilY = (x, y0, y1, r) => Man.cylinder(y1 - y0, r, r, 48).rotate([-90, 0, 0]).translate([x, y0, zc]);
  const caixa = (x0, x1, y0, y1, z0, z1) => Man.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0]);

  const corpos = [], letras = [];
  L.pecas.forEach((P, k) => {
    let corpo = fatia(P.bloco, 0, hB);
    let letra = fatia(P.letra, hB, topo);
    if (k === 0 && !p.semArgola) corpo = corpo.add(fatia(L.argola.externo, 0, hB)).subtract(fatia(L.argola.furo, -1, topo + 1));

    // junta à direita: esta peça é A (língua no meio, com furo)
    const jd = L.juntas[k];
    if (jd) {
      const { xj, yc, W, Lm, cxA } = jd;
      const yL0 = yc - Lm / 2, yL1 = yc + Lm / 2;
      const gf0 = yc - W / 2 - 0.6, gf1 = yL0, gf2 = yL1, gf3 = yc + W / 2 + 0.6;   // inclui a folga axial (onde passa o pino)
      // abre espaço pros garfos de B (cilindro + folga) e pro braço deles
      for (const [a, b] of [[gf0, gf1], [gf2, gf3]]) {
        corpo = corpo.subtract(cilY(xj, a, b, J.Rk + J.c));
        corpo = corpo.subtract(caixa(xj, xj + 50, a, b, -1, hB + 1));
      }
      letra = letra.subtract(cilY(xj, gf0 - 1, gf3 + 1, J.Rk + J.c + 0.2));
      // língua: braço até o centro da letra + cilindro, menos o furo do pino
      corpo = corpo.add(caixa(cxA, xj, yL0, yL1, 0, hB)).add(cilY(xj, yL0, yL1, J.Rk));
      corpo = corpo.subtract(cilY(xj, yL0 - 1, yL1 + 1, J.rp + J.c));
    }
    // junta à esquerda: esta peça é B (dois garfos + pino atravessando a língua)
    const je = L.juntas[k - 1];
    if (je) {
      const { xj, yc, W, Lm, cxB } = je;
      const yL0 = yc - Lm / 2, yL1 = yc + Lm / 2;
      const g0 = yc - W / 2, g1 = yL0 - J.ga, g2 = yL1 + J.ga, g3 = yc + W / 2;
      // abre espaço pra língua de A (cilindro + folga, com a folga axial) e pro braço dela
      corpo = corpo.subtract(cilY(xj, g1, g2, J.Rk + J.c));
      corpo = corpo.subtract(caixa(xj - 50, xj, g1, g2, -1, hB + 1));
      letra = letra.subtract(cilY(xj, g0 - 1, g3 + 1, J.Rk + J.c + 0.2));
      for (const [a, b] of [[g0, g1], [g2, g3]]) corpo = corpo.add(caixa(xj, cxB, a, b, 0, hB)).add(cilY(xj, a, b, J.Rk));
      corpo = corpo.add(cilY(xj, g0 + 0.5, g3 - 0.5, J.rp));     // pino: liga os dois garfos
    }
    corpos.push(semLascas(corpo));
    if (!letra.isEmpty()) letras.push(letra);
  });
  const base = Man.union(corpos), bf = base.boundingBox();
  return {
    partes: [['base', base], ['letras', Man.union(letras)]],
    corpos, J, gap: L.gap, nPecas: L.pecas.length, juntas: L.juntas,
    larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1], alturaTotal: topo,
  };
}

// ---------------- Chaveiro de logo (formato da arte + borda + argola) ----------------
// partes: { arte: cs }
export function layoutChaveiroLogo(partes, p) {
  const C = CS();
  let arte = partes.arte;
  const b0 = arte.bounds();
  const e = p.tamanho / Math.max(b0.max[0] - b0.min[0], b0.max[1] - b0.min[1]);
  arte = arte.scale([e, e]);
  if (p.rotArte) arte = arte.rotate(p.rotArte);
  const b1 = arte.bounds();
  arte = arte.translate([-(b1.min[0] + b1.max[0]) / 2, -(b1.min[1] + b1.max[1]) / 2]);

  const fechar = (cs, r) => r > 0 ? preencherBuracos(cs.offset(r, 'Round', 2, 40)).offset(-r, 'Round', 2, 40) : cs;
  let fecho = p.fecho;
  const montar = f => preencherBuracos(fechar(preencherBuracos(arte), f).offset(p.borda, 'Round', 2, 48));
  let base = montar(fecho);
  while (base.decompose().length > 1 && fecho < 25) { fecho += 1.5; base = montar(fecho); }

  // argola: numa reta na direção escolhida (90° = de baixo pra cima), deslocada de "deslocArgola" mm pro lado;
  // ela encosta no ponto do contorno mais "pra fora" nessa reta. Deslocamento 0 = bem no meio.
  const a = p.anguloArgola * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const bc = base.bounds(), c0 = [(bc.min[0] + bc.max[0]) / 2, (bc.min[1] + bc.max[1]) / 2];
  const t = -(p.deslocArgola || 0);  // positivo = pra direita olhando na direção da argola
  const comp = 4 * Math.hypot(bc.max[0] - bc.min[0], bc.max[1] - bc.min[1]);
  const faixa = C.square([comp, 0.6], true).rotate(p.anguloArgola).translate([c0[0] + vx * t, c0[1] + vy * t]);
  const corte = base.intersect(faixa);
  let melhor = null, dMax = -Infinity;
  const pts = corte.isEmpty() ? base.toPolygons().flat() : corte.toPolygons().flat();
  for (const [x, y] of pts) { const d = x * ux + y * uy; if (d > dMax) { dMax = d; melhor = [x, y]; } }
  const rExt = p.furo / 2 + p.paredeArgola;
  const cx = melhor[0] + ux * (rExt - p.sobreposicao), cy = melhor[1] + uy * (rExt - p.sobreposicao);
  const furo = C.circle(p.furo / 2, 64).translate([cx, cy]);
  const comArgola = base.add(C.circle(rExt, 64).translate([cx, cy]));
  // concordância suave entre argola e contorno (só perto da argola)
  const rf = p.concordancia ?? 1.5;
  const suave = rf > 0 ? comArgola.offset(rf, 'Round', 2, 48).offset(-rf, 'Round', 2, 48).subtract(comArgola)
    .intersect(C.circle(rExt + rf * 2.5, 64).translate([cx, cy])) : null;
  base = (suave ? comArgola.add(suave) : comArgola).subtract(furo);
  arte = arte.subtract(C.circle(p.furo / 2 + 0.8, 64).translate([cx, cy]));   // a arte nunca tampa o furo
  const bf = base.bounds();
  return { base, arte, fechoUsado: fecho, larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1] };
}

export function geoChaveiroLogo(partes, p) {
  const Man = M().Manifold;
  const L = layoutChaveiroLogo(partes, p);
  const eB = p.espBase, ch = Math.min(p.chanfro, 0.8);
  let base = ch > 0
    ? Man.union([L.base.offset(-ch, 'Round', 2, 40).extrude(ch), L.base.extrude(eB - ch).translate([0, 0, ch])])
    : L.base.extrude(eB);
  let arte;
  if (p.acabamento === 'rente') {
    const pr = Math.min(p.relevo, eB - 0.8);
    base = base.subtract(L.arte.extrude(pr + 0.01).translate([0, 0, eB - pr]));
    arte = L.arte.extrude(pr).translate([0, 0, eB - pr]);
  } else arte = L.arte.extrude(p.relevo).translate([0, 0, eB]);
  return { partes: [['base', semLascas(base)], ['arte', arte]], larg: L.larg, alt: L.alt, fechoUsado: L.fechoUsado,
    alturaTotal: eB + (p.acabamento === 'rente' ? 0 : p.relevo) };
}

// ---------------- Ímã de geladeira (formato da arte + bolsões de ímã embutidos com pausa) ----------------
export function formaDaArte(arteCru, p) {
  let arte = arteCru;
  const b0 = arte.bounds();
  const e = p.tamanho / Math.max(b0.max[0] - b0.min[0], b0.max[1] - b0.min[1]);
  arte = arte.scale([e, e]);
  if (p.rotArte) arte = arte.rotate(p.rotArte);
  const b1 = arte.bounds();
  arte = arte.translate([-(b1.min[0] + b1.max[0]) / 2, -(b1.min[1] + b1.max[1]) / 2]);
  const fechar = (cs, r) => r > 0 ? preencherBuracos(cs.offset(r, 'Round', 2, 40)).offset(-r, 'Round', 2, 40) : cs;
  let fecho = p.fecho;
  const montar = f => preencherBuracos(fechar(preencherBuracos(arte), f).offset(p.borda, 'Round', 2, 48));
  let base = montar(fecho);
  while (base.decompose().length > 1 && fecho < 25) { fecho += 1.5; base = montar(fecho); }
  return { arte, base, fechoUsado: fecho };
}

// posições dos ímãs: automáticas (centro / em linha) + deslocamento que o usuário arrastou, sempre dentro da peça
export function layoutIma(partes, p) {
  const C = CS();
  const F = formaDaArte(partes.arte, p);
  const r = p.diamFuro / 2;
  const miolo = F.base.offset(-(r + p.margemIma), 'Round', 2, 48);   // onde o centro do ímã pode ficar
  const dentro = (x, y) => !miolo.isEmpty() && !miolo.intersect(C.square([0.02, 0.02], true).translate([x, y])).isEmpty();
  const maisPerto = (x, y) => {
    let m = null, dm = Infinity;
    for (const [px, py] of miolo.toPolygons().flat()) { const d = (px - x) ** 2 + (py - y) ** 2; if (d < dm) { dm = d; m = [px, py]; } }
    return m || [x, y];
  };
  const bb = F.base.bounds(), cx = (bb.min[0] + bb.max[0]) / 2, cy = (bb.min[1] + bb.max[1]) / 2;
  const passo = p.diamFuro + p.espacoImas;
  const imas = [];
  for (let i = 0; i < p.nImas; i++) {
    const off = p.offsets?.[i] || [0, 0];
    let x = cx + (i - (p.nImas - 1) / 2) * passo + off[0], y = cy + off[1];
    let ajustado = false;
    if (!dentro(x, y)) { [x, y] = maisPerto(x, y); ajustado = true; }
    imas.push({ x, y, ajustado });
  }
  const sobrepostos = imas.some((a, i) => imas.some((b, j) => j > i && Math.hypot(a.x - b.x, a.y - b.y) < p.diamFuro + 0.8));
  const bf = F.base.bounds();
  return { ...F, imas, sobrepostos, semEspaco: miolo.isEmpty(), larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1] };
}

export function geoIma(partes, p) {
  const Man = M().Manifold, C = CS();
  const L = layoutIma(partes, p);
  // bolsão alinhado às camadas: piso fino embaixo (ímã perto da geladeira), tampa em cima
  const h1 = p.primeiraCamada, lh = p.alturaCamada;
  const camadaAcima = z => h1 + Math.ceil((z - h1) / lh - 1e-6) * lh;
  const zFundo = +camadaAcima(Math.max(p.piso, h1)).toFixed(3);
  const zTopo = +camadaAcima(zFundo + p.espIma + p.folgaAltura).toFixed(3);
  const prof = +(zTopo - zFundo).toFixed(3);
  const minimo = zTopo + p.cobertura + (p.acabamento === 'rente' ? p.relevo : 0);
  const eB = +Math.max(p.espBase, camadaAcima(minimo)).toFixed(3);
  const ch = Math.min(p.chanfro, 0.8);
  let base = ch > 0
    ? Man.union([L.base.offset(-ch, 'Round', 2, 40).extrude(ch), L.base.extrude(eB - ch).translate([0, 0, ch])])
    : L.base.extrude(eB);
  const furos = L.imas.map(m => C.circle(p.diamFuro / 2, 64).translate([m.x, m.y]));
  if (furos.length) base = base.subtract(C.union(furos).extrude(prof).translate([0, 0, zFundo]));
  let arte;
  if (p.acabamento === 'rente') {
    const pr = Math.min(p.relevo, eB - zTopo - 0.4);
    base = base.subtract(L.arte.extrude(pr + 0.01).translate([0, 0, eB - pr]));
    arte = L.arte.extrude(pr).translate([0, 0, eB - pr]);
  } else arte = L.arte.extrude(p.relevo).translate([0, 0, eB]);
  const zPausa = +(zTopo + lh).toFixed(2);
  const camada = Math.round((zPausa - h1) / lh) + 1;
  return {
    partes: [['base', semLascas(base)], ['arte', arte]],
    larg: L.larg, alt: L.alt, espBase: eB, alturaTotal: eB + (p.acabamento === 'rente' ? 0 : p.relevo),
    bolsao: { zFundo, zTopo, prof, zPausa, camada }, L,
  };
}

// ---------------- Chaveiro abridor de latinha (forma da arte + rasgo em cunha na borda) ----------------
// O rasgo entra pela borda (direção "anguloRasgo"), com piso em rampa: mais baixo na boca, sobe pra dentro.
export function rasgoAbridor(base2d, p) {
  const C = CS();
  const a = p.anguloRasgo * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const bc = base2d.bounds(), c0 = [(bc.min[0] + bc.max[0]) / 2, (bc.min[1] + bc.max[1]) / 2];
  const t = -(p.deslocRasgo || 0);
  const comp = 4 * Math.hypot(bc.max[0] - bc.min[0], bc.max[1] - bc.min[1]);
  const faixa = C.square([comp, 0.6], true).rotate(p.anguloRasgo).translate([c0[0] + vx * t, c0[1] + vy * t]);
  const corte = base2d.intersect(faixa);
  let pt = null, dMax = -Infinity;
  for (const [x, y] of (corte.isEmpty() ? base2d : corte).toPolygons().flat()) { const d = x * ux + y * uy; if (d > dMax) { dMax = d; pt = [x, y]; } }
  const fora = 4, W = p.larguraRasgo, D = p.profRasgo;
  // pegada 2D do rasgo (pra prévia e checagem): da boca (fora da peça) até D pra dentro
  const canto = (s, w) => [pt[0] + ux * s + vx * w, pt[1] + uy * s + vy * w];
  const pegada = poli([canto(fora, -W / 2), canto(fora, W / 2), canto(-D, W / 2), canto(-D, -W / 2)]);
  // furou o outro lado? (a ponta de dentro do rasgo tem que ficar dentro da peça)
  const ponta = C.square([0.5, W * 0.8], true).rotate(p.anguloRasgo).translate(canto(-D - 0.5, 0));
  const atravessa = base2d.intersect(ponta).area() < 0.5 * 0.5 * W * 0.8 * 0.9;
  return { pt, ux, uy, vx, vy, fora, W, D, pegada, atravessa };
}

export function geoChaveiroAbridor(partes, p) {
  const Man = M().Manifold;
  const L = layoutChaveiroLogo(partes, p);
  const R = rasgoAbridor(L.base, p);
  const eB = p.espBase, ch = Math.min(p.chanfro, 0.8);
  let base = ch > 0
    ? Man.union([L.base.offset(-ch, 'Round', 2, 40).extrude(ch), L.base.extrude(eB - ch).translate([0, 0, ch])])
    : L.base.extrude(eB);
  // cunha do rasgo: piso zBoca na boca, sobe até zFundo lá dentro; teto em zTeto
  const { pt, ux, uy, vx, vy, fora, W, D } = R;
  const zTeto = Math.min(p.zTeto, eB - 1.2), zB = p.zBoca, zF = Math.min(p.zFundoRasgo, zTeto - 1);
  const P3 = (s, w, z) => [pt[0] + ux * s + vx * w, pt[1] + uy * s + vy * w, z];
  const pts = [];
  for (const w of [-W / 2, W / 2]) {
    pts.push(P3(fora, w, zB - (zF - zB) * fora / D), P3(fora, w, zTeto));   // boca (um pouco pra fora)
    pts.push(P3(-D, w, zF), P3(-D, w, zTeto));                               // fundo do rasgo
  }
  base = base.subtract(Man.hull(pts));
  let arte;
  if (p.acabamento === 'rente') {
    const pr = Math.min(p.relevo, eB - zTeto - 0.8);
    base = base.subtract(L.arte.extrude(pr + 0.01).translate([0, 0, eB - pr]));
    arte = L.arte.extrude(pr).translate([0, 0, eB - pr]);
  } else arte = L.arte.extrude(p.relevo).translate([0, 0, eB]);
  return { partes: [['base', semLascas(base)], ['arte', arte]], larg: L.larg, alt: L.alt, L, R,
    alturaTotal: eB + (p.acabamento === 'rente' ? 0 : p.relevo) };
}

// ---------------- Placa adaptável (formato da arte, sem argola; arte na frente e, opcional, nivelada no verso) ----------------
// partes: { arte: cs, verso?: cs | 'mesma' }
export function layoutPlacaAdaptavel(partes, p) {
  const F = formaDaArte(partes.arte, p);
  let verso = null;
  if (p.faces === 'ambas') {
    let v;
    if (partes.verso && partes.verso !== 'mesma') {
      v = caber(partes.verso, p.tamVerso, p.tamVerso);
      if (p.rotVerso) v = v.rotate(p.rotVerso);
    } else v = F.arte;
    const b = v.bounds();
    v = v.translate([-(b.min[0] + b.max[0]) / 2 + (p.versoX || 0), -(b.min[1] + b.max[1]) / 2 + (p.versoY || 0)]);
    // "versoVista" = como quem olha a placa por trás vê; "verso" = espelhado, nas coordenadas da placa
    verso = v.mirror([1, 0]).intersect(F.base.offset(-0.8, 'Round', 2, 40));   // nunca encosta na borda
  }
  const bf = F.base.bounds();
  return { ...F, verso, larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1] };
}

export function geoPlacaAdaptavel(partes, p) {
  const Man = M().Manifold;
  const L = layoutPlacaAdaptavel(partes, p);
  const eB = p.espBase, ch = Math.min(p.chanfro, 0.8);
  let base = ch > 0 && p.faces !== 'ambas'
    ? Man.union([L.base.offset(-ch, 'Round', 2, 40).extrude(ch), L.base.extrude(eB - ch).translate([0, 0, ch])])
    : L.base.extrude(eB);
  const pecas = [];
  let frente;
  if (p.acabamento === 'rente') {
    const pr = Math.min(p.relevo, eB / 2 - 0.2);
    base = base.subtract(L.arte.extrude(pr + 0.01).translate([0, 0, eB - pr]));
    frente = L.arte.extrude(pr).translate([0, 0, eB - pr]);
  } else frente = L.arte.extrude(p.relevo).translate([0, 0, eB]);
  pecas.push(['frente', frente]);
  if (L.verso) {
    // espelhada: lida certo olhando a placa por trás; embutida nas primeiras camadas, nivelada com o fundo
    const pv = Math.min(p.profVerso, eB / 2 - 0.2);
    const v = L.verso;
    base = base.subtract(v.extrude(pv + 0.01).translate([0, 0, -0.01]));
    pecas.push(['verso', v.extrude(pv)]);
  }
  return { partes: [['base', semLascas(base)], ...pecas], larg: L.larg, alt: L.alt, fechoUsado: L.fechoUsado,
    alturaTotal: eB + (p.acabamento === 'rente' ? 0 : p.relevo) };
}

// ---------------- MOLLE tag (placa com 2 rasgos laterais abertos no meio = 4 encaixes) ----------------
export function layoutMolle(partes, p) {
  const C = CS();
  const W = p.largura, H = p.altura;
  let corpo = retArred(W, H, p.raio);
  const rr = p.larguraRasgo / 2;
  const tiras = [];
  for (const s of [-1, 1]) {
    const xc = s * (W / 2 - p.margemRasgo);
    // rasgo em pílula + abertura até a borda, no meio
    const pilula = retArred(p.larguraRasgo, p.comprimentoRasgo, rr - 0.01).translate([xc, 0]);
    const abertura = C.square([p.margemRasgo + 2, p.abertura], true).translate([xc + s * (p.margemRasgo + 2) / 2, 0]);
    tiras.push(pilula.add(abertura));
  }
  let vazio = C.union(tiras);
  // arredonda os cantos vivos da abertura (fechamento do material = "concordância")
  corpo = corpo.subtract(vazio);
  if (p.concordancia > 0) corpo = corpo.offset(-p.concordancia, 'Round', 2, 32).offset(p.concordancia, 'Round', 2, 32).intersect(retArred(W, H, p.raio));
  // área livre pra arte (entre os rasgos)
  const xLivre = W / 2 - p.margemRasgo - rr - 1.5;
  const livre = C.square([2 * xLivre, H - 3], true).intersect(retArred(W, H, p.raio).offset(-1.5, 'Round', 2, 32));
  let arte = null, verso = null;
  const colocar = (cs, tam, rot, x, y) => {
    let a = caber(cs, tam, tam);
    if (rot) a = a.rotate(rot);
    const b = a.bounds();
    return a.translate([x - (b.min[0] + b.max[0]) / 2, y - (b.min[1] + b.max[1]) / 2]).intersect(livre);
  };
  if (partes.arte) arte = colocar(partes.arte, p.tamArte, p.rotArte, p.arteX, p.arteY);
  if (p.faces === 'ambas' && partes.arte) {
    const src = partes.verso && partes.verso !== 'mesma' ? partes.verso : partes.arte;
    const mesma = !(partes.verso && partes.verso !== 'mesma');
    verso = colocar(src, mesma ? p.tamArte : p.tamVerso, mesma ? p.rotArte : p.rotVerso, mesma ? p.arteX : p.versoX, mesma ? p.arteY : p.versoY)
      .mirror([1, 0]).intersect(livre);     // espelhada: lida certo olhando por trás
  }
  return { corpo, arte, verso, livre, xLivre };
}

export function geoMolle(partes, p) {
  const L = layoutMolle(partes, p);
  const e = p.espessura;
  let corpo = L.corpo.extrude(e);
  const pecas = [];
  if (L.arte) {
    if (p.acabamento === 'rente') {
      const pr = Math.min(p.relevo, e / 2 - 0.2);
      corpo = corpo.subtract(L.arte.extrude(pr + 0.01).translate([0, 0, e - pr]));
      pecas.push(['frente', L.arte.extrude(pr).translate([0, 0, e - pr])]);
    } else pecas.push(['frente', L.arte.extrude(p.relevo).translate([0, 0, e])]);
  }
  if (L.verso) {
    const pv = Math.min(p.profVerso, e / 2 - 0.2);
    corpo = corpo.subtract(L.verso.extrude(pv + 0.01).translate([0, 0, -0.01]));
    pecas.push(['verso', L.verso.extrude(pv)]);
  }
  return { partes: [['corpo', semLascas(corpo)], ...pecas], alturaTotal: e + (L.arte && p.acabamento !== 'rente' ? p.relevo : 0) };
}

// ---------------- Marca-página (haste longa com presilha em U + cabeça no formato da arte) ----------------
export function layoutMarcaPagina(partes, p) {
  const C = CS();
  const F = formaDaArte(partes.arte, p);
  const w = p.larguraHaste, L = p.comprimentoHaste;
  // haste: retângulo com a ponta de baixo arredondada, de y=0 até y=L
  const haste = retCantos(w, L, [0, 0, p.raioPonta, p.raioPonta]).translate([0, L / 2]);
  // cabeça: base da arte, com a parte de baixo entrando "sobreposicao" mm na haste
  const bb = F.base.bounds(), cxA = (bb.min[0] + bb.max[0]) / 2;
  const dy = L - p.sobreposicao - bb.min[1];
  const cabeca = F.base.translate([-cxA, dy]);
  const arte = F.arte.translate([-cxA, dy]);
  let corpo = haste.add(cabeca);
  // presilha em U: dois cortes finos ligados embaixo; a língua do meio fica presa em cima
  let presilha = null;
  if (p.presilha) {
    const yTopo = Math.min(L - p.sobreposicao, cabeca.bounds().min[1]) - 0.1;
    const y0 = p.inicioPresilha, ext = p.larguraLingua / 2 + p.corte, rI = p.larguraLingua / 2;
    const fora = retCantos(2 * ext, yTopo - y0, [0, 0, ext * 0.7, ext * 0.7]).translate([0, (y0 + yTopo) / 2]);
    const dentro = retCantos(2 * rI, yTopo - y0 - p.corte + 1, [0, 0, rI * 0.7, rI * 0.7]).translate([0, (y0 + p.corte + yTopo + 1) / 2]);
    presilha = fora.subtract(dentro);
    corpo = corpo.subtract(presilha);
  }
  const bf = corpo.bounds();
  return { corpo, arte, presilha, cabeca, larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1], fechoUsado: F.fechoUsado,
    cabecaTam: [cabeca.bounds().max[0] - cabeca.bounds().min[0], cabeca.bounds().max[1] - cabeca.bounds().min[1]] };
}

export function geoMarcaPagina(partes, p) {
  const L = layoutMarcaPagina(partes, p);
  const e = p.espBase;
  let corpo = L.corpo.extrude(e), arte;
  if (p.acabamento === 'rente') {
    const pr = Math.min(p.relevo, e - 0.6);
    corpo = corpo.subtract(L.arte.extrude(pr + 0.01).translate([0, 0, e - pr]));
    arte = L.arte.extrude(pr).translate([0, 0, e - pr]);
  } else arte = L.arte.extrude(p.relevo).translate([0, 0, e]);
  return { partes: [['corpo', semLascas(corpo)], ['arte', arte]], L, alturaTotal: e + (p.acabamento === 'rente' ? 0 : p.relevo) };
}

// ---------------- Clipe de papel (dois "U" de fio encaixados + bloco + cabeça no formato da arte) ----------------
export function layoutClipe(partes, p) {
  const C = CS();
  const F = formaDaArte(partes.arte, p);
  const w = p.larguraFio, top = p.comprimento;
  const U = (a, yb) => {
    const fora = retCantos(2 * a, top - yb, [0, 0, a, a]).translate([0, (top + yb) / 2]);
    const ai = a - w, h = top - yb - w + 1;
    const dentro = retCantos(2 * ai, h, [0, 0, ai, ai]).translate([0, yb + w + h / 2]);
    return fora.subtract(dentro);
  };
  const a1 = p.larguraClipe / 2, a2 = a1 - w - p.folga;
  const fioFora = U(a1, 0), fioDentro = U(a2, w + p.folgaFundo);
  const bloco = C.square([2 * a1 + 1, p.alturaBloco], true).translate([0, top - 0.8 + p.alturaBloco / 2]);
  const bb = F.base.bounds(), cxA = (bb.min[0] + bb.max[0]) / 2, dy = top - 1 - bb.min[1];
  const cabeca = F.base.translate([-cxA, dy]), arte = F.arte.translate([-cxA, dy]);
  const corpo = C.union([fioFora, fioDentro, bloco, cabeca]);
  const bf = corpo.bounds(), bc = cabeca.bounds();
  return { corpo, arte, larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1], fechoUsado: F.fechoUsado,
    cabecaTam: [bc.max[0] - bc.min[0], bc.max[1] - bc.min[1]] };
}

export function geoClipe(partes, p) {
  const L = layoutClipe(partes, p);
  const e = p.espBase;
  let corpo = L.corpo.extrude(e), arte;
  if (p.acabamento === 'rente') {
    const pr = Math.min(p.relevo, e - 0.6);
    corpo = corpo.subtract(L.arte.extrude(pr + 0.01).translate([0, 0, e - pr]));
    arte = L.arte.extrude(pr).translate([0, 0, e - pr]);
  } else arte = L.arte.extrude(p.relevo).translate([0, 0, e]);
  return { partes: [['corpo', semLascas(corpo)], ['arte', arte]], L, alturaTotal: e + (p.acabamento === 'rente' ? 0 : p.relevo) };
}

// ---------------- Clipe de saco (mola em "W" + bloco + cabeça no formato da arte) ----------------
// perfil da mola tirado do modelo original (mm, base em y=0, centrado em x=0)
const PERFIL_MOLA_SACO = [[2.543, 16.45], [2.807, 3.599], [3.016, 3.102], [3.278, 2.83], [3.811, 2.575], [4.196, 2.572], [4.552, 2.75], [4.711, 2.912], [4.855, 3.122], [5.097, 3.684], [4.788, 17.96], [4.641, 18.696], [4.508, 19.075], [4.12, 19.845], [3.865, 20.227], [3.233, 20.943], [2.442, 21.531], [1.994, 21.754], [1.518, 21.923], [0.506, 22.089], [-0.013, 22.086], [-1.033, 21.915], [-1.977, 21.535], [-2.791, 20.958], [-3.447, 20.215], [-3.945, 19.365], [-4.452, 18.051], [-4.666, 17.231], [-4.796, 16.484], [-4.985, 3.61], [-4.862, 3.13], [-4.625, 2.792], [-4.287, 2.595], [-3.884, 2.529], [-3.47, 2.6], [-3.101, 2.834], [-2.813, 3.257], [-2.704, 3.541], [-2.618, 3.873], [-2.618, 15.947], [-2.354, 16.6], [-2.092, 16.979], [-1.75, 17.266], [-1.549, 17.355], [-1.226, 17.397], [-1.01, 17.353], [-0.806, 17.246], [-0.54, 16.962], [-0.335, 16.528], [-0.198, 15.947], [-0.227, 3.253], [-0.495, 2.364], [-1.047, 1.43], [-1.586, 0.858], [-2.259, 0.398], [-3.045, 0.104], [-3.891, 0.0], [-4.72, 0.079], [-5.104, 0.179], [-5.773, 0.476], [-6.292, 0.871], [-6.678, 1.329], [-7.091, 2.079], [-7.471, 3.126], [-7.295, 24.127], [-7.375, 24.541], [-7.345, 24.837], [-7.249, 25.13], [-7.098, 25.38], [-6.851, 25.551], [-6.572, 25.508], [-5.934, 25.002], [-5.829, 24.988], [-5.741, 25.054], [-5.592, 25.556], [-5.501, 26.842], [6.881, 26.842], [7.471, 2.65], [7.166, 1.934], [6.978, 1.621], [6.527, 1.083], [6.267, 0.86], [5.68, 0.506], [5.358, 0.375], [4.672, 0.207], [3.959, 0.16], [3.259, 0.229], [2.61, 0.405], [1.788, 0.839], [1.17, 1.425], [0.735, 2.103], [0.532, 2.585], [0.391, 3.082], [0.309, 3.592], [0.309, 15.975], [0.551, 16.77], [0.793, 17.152], [0.958, 17.294], [1.387, 17.451], [1.631, 17.443], [1.872, 17.367], [2.273, 17.042], [2.412, 16.837]];
export function layoutClipeSaco(partes, p) {
  const C = CS();
  const F = formaDaArte(partes.arte, p);
  const s = p.escalaClipe / 100;
  // laterais retas e alinhadas: a mola original tem a lateral levemente inclinada (7,47 → 7,38 mm),
  // o que deixava "degraus" na lateral junto do bloco. Corta a mola numa largura fixa e usa a MESMA no bloco.
  const meia = 7.35 * s, yBloco0 = 20 * s, yBloco1 = 32.44 * s;
  // a mola original é um pouco torta (lado direito afina de 7,46 pra 7,07 mm): usa a metade esquerda espelhada,
  // corta reto em ±meia e reforça as duas laterais com uma faixa reta, pra lateral ficar lisa dos dois lados
  const molaOrig = poli(PERFIL_MOLA_SACO).scale([s, s]);
  const esq = molaOrig.intersect(C.square([50, 100], false).translate([-50, -10]));
  const faixa = C.square([0.8 * s, yBloco0 + 1 - 4 * s], false);
  const mola = esq.add(esq.mirror([1, 0])).intersect(C.square([2 * meia, 100], true).translate([0, 50]))
    .add(faixa.translate([meia - 0.8 * s, 4 * s])).add(faixa.translate([-meia, 4 * s]));
  const bloco = C.square([2 * meia, yBloco1 - yBloco0], true).translate([0, (yBloco0 + yBloco1) / 2]);
  const bb = F.base.bounds(), cxA = (bb.min[0] + bb.max[0]) / 2, dy = 25.6 * s + p.ajusteCabeca - bb.min[1];
  let cabeca = F.base.translate([-cxA, dy]), arte = F.arte.translate([-cxA, dy]);
  // abaixo do topo do bloco, a cabeça não pode passar da lateral do bloco (senão cria "calombos" na lateral)
  const lado = C.square([200, yBloco1 + 200], false);
  const foraLateral = C.union([lado.translate([meia, -200]), lado.translate([-meia - 200, -200])]);
  cabeca = cabeca.subtract(foraLateral); arte = arte.subtract(foraLateral);
  const corpo = C.union([mola, bloco, cabeca]);
  const bf = corpo.bounds(), bc = cabeca.bounds();
  return { corpo, arte, larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1], fechoUsado: F.fechoUsado,
    cabecaTam: [bc.max[0] - bc.min[0], bc.max[1] - bc.min[1]] };
}
export function geoClipeSaco(partes, p) {
  const L = layoutClipeSaco(partes, p);
  const e = p.espBase;
  let corpo = L.corpo.extrude(e), arte;
  if (p.acabamento === 'rente') {
    const pr = Math.min(p.relevo, e - 0.6);
    corpo = corpo.subtract(L.arte.extrude(pr + 0.01).translate([0, 0, e - pr]));
    arte = L.arte.extrude(pr).translate([0, 0, e - pr]);
  } else arte = L.arte.extrude(p.relevo).translate([0, 0, e]);
  return { partes: [['corpo', semLascas(corpo)], ['arte', arte]], L, alturaTotal: e + (p.acabamento === 'rente' ? 0 : p.relevo) };
}

// ---------------- Topo de bolo (texto em várias linhas + base de contorno + hastes pontudas) ----------------
// partes: { linhas: [cs|null] } cada linha já na escala (altura da maiúscula = p.alturaTexto), linha de base em y=0
export function layoutTopoBolo(partes, p) {
  const C = CS();
  const passo = p.alturaTexto * p.entrelinha;
  const blocos = [];
  let yLinha = 0, capAnterior = 0;
  partes.linhas.forEach((l, i) => {
    if (!l) return;
    const b = l.bounds();
    const capa = p.alturaTexto * (i === 0 ? (p.fatorPrimeira || 1) : 1);
    yLinha = i === 0 ? 0 : yLinha - (capAnterior * 0.28 + capa) * p.entrelinha;
    capAnterior = capa;
    blocos.push(l.translate([-(b.min[0] + b.max[0]) / 2, yLinha]));
  });
  if (!blocos.length) throw new Error('Digite o texto.');
  let texto = C.union(blocos);
  if (p.engrossar > 0) texto = texto.offset(p.engrossar, 'Round', 2, 24);
  const fechar = (cs, r) => r > 0 ? preencherBuracos(cs.offset(r, 'Round', 2, 40)).offset(-r, 'Round', 2, 40) : cs;
  let fecho = p.fecho, base = preencherBuracos(fechar(texto, fecho).offset(p.borda, 'Round', 2, 48));
  while (base.decompose().length > 1 && fecho < 25) { fecho += 1.5; base = preencherBuracos(fechar(texto, fecho).offset(p.borda, 'Round', 2, 48)); }
  // hastes: retas com ponta, subindo até o meio da base
  const bb = base.bounds(), yBase = bb.min[1], w = p.larguraHaste;
  const n = Math.max(1, Math.round(p.nHastes));
  const xs = n === 1 ? [0] : Array.from({ length: n }, (_, i) => -p.distHastes / 2 + i * p.distHastes / (n - 1));
  const yTopo = (bb.min[1] + bb.max[1]) / 2, yPonta = yBase - p.comprimentoHaste;
  const ponta = Math.min(p.ponta, p.comprimentoHaste * 0.5);
  const hastes = xs.map(x => poli([
    [x - w / 2, yTopo], [x - w / 2, yPonta + ponta], [x - p.larguraPonta / 2, yPonta],
    [x + p.larguraPonta / 2, yPonta], [x + w / 2, yPonta + ponta], [x + w / 2, yTopo]]));
  // garante que cada haste encosta na base (se o texto não cobre aquele x, avisa)
  const soltas = hastes.filter(h => h.intersect(base).area() < w * 2).length;
  const corpo = base.add(C.union(hastes));
  const bf = corpo.bounds();
  return { corpo, texto, fechoUsado: fecho, soltas, larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1],
    textoTam: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1]] };
}

export function geoTopoBolo(partes, p) {
  const L = layoutTopoBolo(partes, p);
  const e = p.espBase;
  let corpo = L.corpo.extrude(e), texto;
  if (p.acabamento === 'rente') {
    const pr = Math.min(p.relevo, e - 1);
    corpo = corpo.subtract(L.texto.extrude(pr + 0.01).translate([0, 0, e - pr]));
    texto = L.texto.extrude(pr).translate([0, 0, e - pr]);
  } else texto = L.texto.extrude(p.relevo).translate([0, 0, e]);
  return { partes: [['base', semLascas(corpo)], ['texto', texto]], L, alturaTotal: e + (p.acabamento === 'rente' ? 0 : p.relevo) };
}

// ---------------- Palavras encaixadas (palavra base grossa + segunda frase que encaixa num rebaixo) ----------------
// partes: { letras: [cs|null] (palavra base, uma forma por letra, mesma escala), frase: cs }
export function layoutEncaixe(partes, p) {
  const C = CS();
  // palavra base: letras coladas, cada uma sobrepondo "uniao" mm na anterior (fica uma peça só)
  // cada letra vem chegando até ENCOSTAR de verdade na anterior e depois entra mais "uniao" mm
  let base = null, x = null, pend = 0;
  for (let l of partes.letras) {
    if (!l) { pend += p.alturaBase * 0.35; continue; }
    if (p.engrossarBase > 0) l = l.offset(p.engrossarBase, 'Round', 2, 24);
    const b = l.bounds();
    if (base === null) { base = l.translate([-b.min[0], 0]); x = base.bounds().max[0]; continue; }
    let dx = x + pend - b.min[0];
    if (pend === 0) {
      const passo = 0.25, limite = b.max[0] - b.min[0];
      let andou = 0;
      while (andou < limite && base.intersect(l.translate([dx - andou, 0])).area() < 0.05) andou += passo;
      dx -= andou + p.uniao;
    }
    base = base.add(l.translate([dx, 0]));
    x = base.bounds().max[0]; pend = 0;
  }
  if (!base) throw new Error('Digite a palavra base.');
  const bb = base.bounds();
  base = base.translate([-(bb.min[0] + bb.max[0]) / 2, -(bb.min[1] + bb.max[1]) / 2]);
  let frase = null, encaixe = null, pino = null;
  if (partes.frase) {
    const bf = partes.frase.bounds();
    frase = partes.frase.translate([-(bf.min[0] + bf.max[0]) / 2 + p.fraseX, -(bf.min[1] + bf.max[1]) / 2 + p.fraseY]);
    // pingos/acentos que caem num vão da palavra base ficariam soltos: liga cada um à letra mais perto
    if (p.ligarSoltos) {
      for (const peca of frase.decompose()) {
        if (peca.intersect(base).area() >= 0.5) continue;
        const resto = frase.subtract(peca.offset(0.01, 'Round', 2, 16));
        if (resto.isEmpty()) continue;
        let r = 0.5;
        while (r < 6 && peca.offset(r, 'Round', 2, 24).intersect(resto).isEmpty()) r += 0.25;
        const perto = resto.intersect(peca.offset(r + 0.6, 'Round', 2, 24));
        const ponte = peca.add(perto).offset(r, 'Round', 2, 24).offset(-r, 'Round', 2, 24).intersect(peca.offset(r + 0.6, 'Round', 2, 24));
        frase = frase.add(ponte);
      }
    }
    encaixe = frase.offset(p.folga, 'Round', 2, 32).intersect(base);          // rebaixo na palavra base
    pino = frase.intersect(base.offset(-p.folga, 'Round', 2, 32));             // parte da frase que entra no rebaixo
  }
  const soltos = frase ? frase.decompose().filter(c => c.intersect(base).area() < 0.5).length : 0;
  const b2 = (frase ? base.add(frase) : base).bounds();
  return { base, frase, encaixe, pino, soltos, larg: b2.max[0] - b2.min[0], alt: b2.max[1] - b2.min[1] };
}

export function geoEncaixe(partes, p) {
  const L = layoutEncaixe(partes, p);
  const E = p.espBase, enc = Math.min(p.profEncaixe, E - 1.2), ef = p.espFrase;
  let base = L.base.extrude(E);
  const montado = [], imprimir = [];
  if (L.frase) {
    base = base.subtract(L.encaixe.extrude(enc + 0.01).translate([0, 0, E - enc]));
    // frase: pino (embaixo, entra no rebaixo) + frase inteira por cima
    let frase = L.frase.extrude(ef).translate([0, 0, enc]);
    if (!L.pino.isEmpty()) frase = frase.add(L.pino.extrude(enc + 0.01));
    base = semLascas(base);
    montado.push(['base', base], ['frase', frase.translate([0, 0, E - enc])]);
    // pra imprimir: frase de cabeça pra baixo (face da frente na mesa, pino pra cima, sem suporte)
    const virada = frase.rotate([180, 0, 0]);
    const vb = virada.boundingBox(), bb = base.boundingBox();
    imprimir.push(['base', base], ['frase', virada.translate([0, bb.min[1] - 8 - vb.max[1], -vb.min[2]])]);
  } else {
    base = semLascas(base);
    montado.push(['base', base]); imprimir.push(['base', base]);
  }
  return { montado, imprimir, L, alturaTotal: E + (L.frase ? ef : 0), enc };
}

// ---------------- Carimbos pra brigadeiro (cabo torneado + arte em relevo no topo, vários de uma vez) ----------------
// perfil (raio, altura) tirado do modelo original: Ø20 × 30 mm
const PERFIL_CARIMBO = [[8.35, 0.0], [8.35, 0.25], [8.35, 0.5], [8.35, 0.75], [8.35, 1.0], [8.35, 1.25], [8.35, 1.5], [8.35, 1.75], [8.269, 2.0], [8.051, 2.25], [7.704, 2.5], [7.282, 2.75], [6.825, 3.0], [6.325, 3.25], [6.0, 3.5], [5.857, 3.75], [5.746, 4.0], [5.663, 4.25], [5.6, 4.5], [5.546, 4.75], [5.493, 5.0], [5.443, 5.25], [5.398, 5.5], [5.36, 5.75], [5.33, 6.0], [5.309, 6.25], [5.3, 6.5], [5.297, 6.75], [5.295, 7.0], [5.293, 7.25], [5.29, 7.5], [5.288, 7.75], [5.287, 8.0], [5.285, 8.25], [5.284, 8.5], [5.283, 8.75], [5.282, 9.0], [5.281, 9.25], [5.28, 9.5], [5.28, 9.75], [5.28, 10.0], [5.281, 10.25], [5.283, 10.5], [5.287, 10.75], [5.292, 11.0], [5.298, 11.25], [5.305, 11.5], [5.312, 11.75], [5.32, 12.0], [5.331, 12.25], [5.346, 12.5], [5.365, 12.75], [5.387, 13.0], [5.412, 13.25], [5.44, 13.5], [5.469, 13.75], [5.5, 14.0], [5.534, 14.25], [5.575, 14.5], [5.621, 14.75], [5.671, 15.0], [5.725, 15.25], [5.782, 15.5], [5.84, 15.75], [5.9, 16.0], [5.963, 16.25], [6.031, 16.5], [6.103, 16.75], [6.179, 17.0], [6.258, 17.25], [6.338, 17.5], [6.419, 17.75], [6.5, 18.0], [6.58, 18.25], [6.66, 18.5], [6.741, 18.75], [6.824, 19.0], [6.91, 19.25], [7.001, 19.5], [7.097, 19.75], [7.2, 20.0], [7.312, 20.25], [7.434, 20.5], [7.565, 20.75], [7.703, 21.0], [7.847, 21.25], [7.995, 21.5], [8.147, 21.75], [8.3, 22.0], [8.464, 22.25], [8.644, 22.5], [8.831, 22.75], [9.017, 23.0], [9.192, 23.25], [9.35, 23.5], [9.493, 23.75], [9.626, 24.0], [9.746, 24.25], [9.85, 24.5], [9.948, 24.75], [10.0, 25.0], [10.0, 25.25], [10.0, 25.5], [10.0, 25.75], [10.0, 26.0], [10.0, 26.25], [10.0, 26.5], [10.0, 26.75], [10.0, 27.0], [10.0, 27.25], [10.0, 27.5], [10.0, 27.75], [10.0, 28.0], [10.0, 28.25], [10.0, 28.5], [10.0, 28.75], [10.0, 29.0], [10.0, 29.25], [10.0, 29.5], [10.0, 29.75], [10.0, 29.998]];
export function corpoCarimbo(p) {
  const Man = M().Manifold, sr = p.diametro / 20, sz = p.alturaCabo / 30;
  const pts = [[0, 0], ...PERFIL_CARIMBO.map(([r, z]) => [r * sr, z * sz]), [0, 30 * sz]];
  return Man.revolve(poli(pts), 96);
}
// artes: [cs|null] cruas -> [{ i, arte(cs posicionada, centrada em 0,0) }]
export function artesCarimbo(artes, p) {
  const C = CS(), lim = C.circle(p.diametro / 2 - p.margem, 96);
  return artes.map((a, i) => {
    if (!a) return null;
    let r = caber(a, p.tamArte, p.tamArte);
    if (p.rotArte) r = r.rotate(p.rotArte);
    if (p.espelhar) r = r.mirror([1, 0]);
    const b = r.bounds();
    return { i, arte: r.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]).intersect(lim) };
  }).filter(Boolean);
}
export function geoCarimbos(artes, p) {
  const Man = M().Manifold;
  const lista = artesCarimbo(artes, p);
  if (!lista.length) throw new Error('Envie pelo menos uma arte.');
  const corpo = corpoCarimbo(p), passo = p.diametro + p.espaco, h = p.alturaCabo;
  const n = lista.length, x0 = -(n - 1) * passo / 2;
  const corpos = [], relevos = [];
  lista.forEach((it, k) => {
    const x = x0 + k * passo;
    corpos.push(corpo.translate([x, 0, 0]));
    relevos.push(it.arte.extrude(p.relevo).translate([x, 0, h]));
  });
  return { partes: [['corpo', Man.union(corpos)], ['arte', Man.union(relevos)]], n, lista, passo, x0 };
}

// ---------------- Tag de pet (nome/arte, forma da arte/texto/conjunto/círculo, NFC embutido com pausa, telefone no verso) ----------------
// partes: { arte?: cs, texto?: cs, verso?: cs }
export function layoutTagPet(partes, p) {
  const C = CS();
  const centrar = cs => { const b = cs.bounds(); return cs.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]); };
  let arte = partes.arte ? centrar(caber(partes.arte, p.tamArte, p.tamArte)) : null;
  if (arte && p.rotArte) arte = centrar(arte.rotate(p.rotArte));
  let texto = partes.texto ? centrar(caber(partes.texto, p.larguraTexto, p.alturaTexto)) : null;
  if (texto && p.engrossar > 0) texto = texto.offset(p.engrossar, 'Round', 2, 24);
  if (arte && texto) {   // arte em cima, nome embaixo
    const ha = alt(arte), ht = alt(texto), tot = ha + p.espaco + ht;
    arte = arte.translate([0, tot / 2 - ha / 2]);
    texto = texto.translate([0, -tot / 2 + ht / 2 + p.textoY]);
  }
  const tudo = arte && texto ? arte.add(texto) : (arte || texto);
  if (!tudo) throw new Error('Coloque o nome ou uma arte.');
  const fechar = (cs, r) => r > 0 ? preencherBuracos(cs.offset(r, 'Round', 2, 40)).offset(-r, 'Round', 2, 40) : cs;
  const contornoDe = fonte => {
    let f = p.fecho, b;
    const m = k => preencherBuracos(fechar(preencherBuracos(fonte), k).offset(p.borda, 'Round', 2, 48));
    b = m(f);
    while (b.decompose().length > 1 && f < 25) { f += 1.5; b = m(f); }
    return b;
  };
  let base;
  const fonteForma = p.forma === 'arte' && arte ? arte : p.forma === 'texto' && texto ? texto : tudo;
  if (p.forma === 'circulo') {
    const b = tudo.bounds(), r = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1]) / 2 * p.folgaCirculo + p.borda;
    base = C.circle(Math.max(r, p.diamNFC / 2 + p.margemNFC + 1), 128).translate([(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2]);
  } else base = contornoDe(fonteForma);
  // o que ficou fora da forma escolhida (ex.: nome maior que a arte) é cortado
  const dentro = base.offset(-0.8, 'Round', 2, 40);
  if (arte) arte = arte.intersect(dentro);
  if (texto) texto = texto.intersect(dentro);

  // argola (mesma lógica do chaveiro de logo)
  if (p.argola) {
    const a = p.anguloArgola * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    const bc = base.bounds(), c0 = [(bc.min[0] + bc.max[0]) / 2, (bc.min[1] + bc.max[1]) / 2];
    const comp = 4 * Math.hypot(bc.max[0] - bc.min[0], bc.max[1] - bc.min[1]);
    const faixa = C.square([comp, 0.6], true).rotate(p.anguloArgola).translate([c0[0] - vx * (p.deslocArgola || 0), c0[1] - vy * (p.deslocArgola || 0)]);
    const corte = base.intersect(faixa);
    let pt = null, dMax = -Infinity;
    for (const [x, y] of (corte.isEmpty() ? base : corte).toPolygons().flat()) { const d = x * ux + y * uy; if (d > dMax) { dMax = d; pt = [x, y]; } }
    const rExt = p.furo / 2 + p.paredeArgola;
    const cx = pt[0] + ux * (rExt - p.sobreposicao), cy = pt[1] + uy * (rExt - p.sobreposicao);
    const furo = C.circle(p.furo / 2, 64).translate([cx, cy]);
    let com = base.add(C.circle(rExt, 64).translate([cx, cy]));
    const suave = com.offset(1.5, 'Round', 2, 48).offset(-1.5, 'Round', 2, 48).subtract(com).intersect(C.circle(rExt + 4, 64).translate([cx, cy]));
    base = com.add(suave).subtract(furo);
    const livre = C.circle(p.furo / 2 + 0.8, 64).translate([cx, cy]);
    if (arte) arte = arte.subtract(livre);
    if (texto) texto = texto.subtract(livre);
  }

  // NFC: bolsão redondo no meio do corpo (dá pra ajustar), sempre dentro da peça
  let nfc = null;
  if (p.nfc) {
    const r = p.diamNFC / 2 + p.folgaNFC, miolo = base.offset(-(r + p.margemNFC), 'Round', 2, 48);
    const b = base.bounds();
    let x = (b.min[0] + b.max[0]) / 2 + p.nfcX, y = (b.min[1] + b.max[1]) / 2 + p.nfcY, ajustado = false, semEspaco = miolo.isEmpty();
    if (!semEspaco && miolo.intersect(C.square([0.02, 0.02], true).translate([x, y])).isEmpty()) {
      let m = null, dm = Infinity;
      for (const [px, py] of miolo.toPolygons().flat()) { const dd = (px - x) ** 2 + (py - y) ** 2; if (dd < dm) { dm = dd; m = [px, py]; } }
      [x, y] = m; ajustado = true;
    }
    nfc = semEspaco ? { semEspaco: true } : { x, y, r, ajustado, semEspaco };
  }

  // verso: telefone/texto nivelado no fundo, espelhado (lê certo olhando por trás)
  let verso = null;
  if (partes.verso) {
    const lim = base.offset(-1.5, 'Round', 2, 40), lb = lim.bounds();
    verso = centrar(caber(partes.verso, (lb.max[0] - lb.min[0]) * (p.versoGrande ? 0.8 : 0.92), Math.min(p.versoGrande ? 1e4 : p.alturaVerso, (lb.max[1] - lb.min[1]) * (p.versoGrande ? 0.8 : 0.9))));
    const bb = base.bounds();
    // posiciona na vista de trás (x invertido) e espelha pra coordenada da peça
    verso = verso.translate([-(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2 + p.versoY]).mirror([1, 0]).intersect(lim);
    if (verso.isEmpty()) verso = null;
  }
  const bf = base.bounds();
  return { base, arte, texto, verso, nfc, larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1] };
}

export function geoTagPet(partes, p) {
  const Man = M().Manifold, C = CS();
  const L = layoutTagPet(partes, p);
  const h1 = p.primeiraCamada, lh = p.alturaCamada;
  const acima = z => h1 + Math.ceil((z - h1) / lh - 1e-6) * lh;
  const pv = L.verso ? acima(Math.max(p.profVerso, h1)) : 0;
  let bolsao = null, eB = p.espBase;
  if (L.nfc && !L.nfc.semEspaco) {
    const zFundo = +acima(Math.max(pv + 0.4, p.pisoNFC, h1)).toFixed(3);
    const zTopo = +acima(zFundo + p.espNFC + 0.15).toFixed(3);
    eB = +Math.max(eB, acima(zTopo + p.coberturaNFC + (p.acabamento === 'rente' ? p.relevo : 0))).toFixed(3);
    bolsao = { zFundo, zTopo, zPausa: +(zTopo + lh).toFixed(2), camada: Math.round((zTopo + lh - h1) / lh) + 1 };
  }
  let base = L.base.extrude(eB);
  if (bolsao) base = base.subtract(C.circle(L.nfc.r, 96).translate([L.nfc.x, L.nfc.y]).extrude(bolsao.zTopo - bolsao.zFundo).translate([0, 0, bolsao.zFundo]));
  const pecas = [];
  const colocar = (cs, id) => {
    if (!cs || cs.isEmpty()) return;
    if (p.acabamento === 'rente') {
      const pr = Math.min(p.relevo, eB - (bolsao ? bolsao.zTopo + 0.4 : 0.8));
      base = base.subtract(cs.extrude(pr + 0.01).translate([0, 0, eB - pr]));
      pecas.push([id, cs.extrude(pr).translate([0, 0, eB - pr])]);
    } else pecas.push([id, cs.extrude(p.relevo).translate([0, 0, eB])]);
  };
  colocar(L.texto, 'texto'); colocar(L.arte, 'arte');
  if (L.verso) { base = base.subtract(L.verso.extrude(pv + 0.01).translate([0, 0, -0.01])); pecas.push(['verso', L.verso.extrude(pv)]); }
  return { partes: [['base', semLascas(base)], ...pecas], L, espBase: eB, bolsao,
    alturaTotal: eB + (p.acabamento === 'rente' ? 0 : p.relevo) };
}

// ---------------- Suporte de headset (haste chapada com "sela" curva + base com nome em relevo) ----------------
// partes: { texto?: cs, arte?: cs }
export function layoutHeadset(partes, p) {
  const C = CS();
  const R = p.raioSela, t = p.espSela, H = p.alturaHaste, wP = p.larguraHaste;
  const yc = H - R, a0 = (90 - p.aberturaSela) * Math.PI / 180, a1 = (90 + p.aberturaSela) * Math.PI / 180, n = 64;
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([R * Math.cos(a), yc + R * Math.sin(a)]); }
  for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; pts.push([(R - t) * Math.cos(a), yc + (R - t) * Math.sin(a)]); }
  let sela = poli(pts);
  for (const a of [a0, a1]) sela = sela.add(C.circle(t / 2 + p.labio, 48).translate([(R - t / 2) * Math.cos(a), yc + (R - t / 2) * Math.sin(a)]));
  const haste = C.square([wP, H - t / 2 + p.profEncaixe], false).translate([-wP / 2, -p.profEncaixe]);
  const figura = sela.add(haste);
  // base vista de cima: rasgo atrás, nome/arte na frente
  const W = p.larguraBase, D = p.profBase, m = p.margemTexto;
  const yRasgo = D / 2 - p.espessura / 2 - p.recuoHaste;
  const frenteY0 = -D / 2 + m, frenteY1 = yRasgo - p.espessura / 2 - 4;
  let texto = null, arte = null;
  const areaW = W - 2 * m, areaH = Math.max(4, frenteY1 - frenteY0);
  if (partes.arte) arte = caber(partes.arte, Math.min(p.tamArte, areaH), Math.min(p.tamArte, areaH));
  if (partes.texto) texto = caber(partes.texto, areaW - (arte ? (arte.bounds().max[0] - arte.bounds().min[0]) + 4 : 0), Math.min(p.alturaTexto, areaH));
  const cy = (frenteY0 + frenteY1) / 2 + p.textoY;
  const larg = cs => cs ? cs.bounds().max[0] - cs.bounds().min[0] : 0;
  const total = larg(arte) + larg(texto) + (arte && texto ? 4 : 0);
  let x = -total / 2;
  const colocar = cs => { const b = cs.bounds(); const r = cs.translate([x - b.min[0], cy - (b.min[1] + b.max[1]) / 2]); x += larg(cs) + 4; return r; };
  if (arte) arte = colocar(arte);
  if (texto) texto = colocar(texto);
  return { figura, texto, arte, yRasgo, alturaTotal: p.alturaBase + H, larguraSela: 2 * R * Math.sin(p.aberturaSela * Math.PI / 180) + t };
}

export function geoHeadset(partes, p) {
  const C = CS();
  const L = layoutHeadset(partes, p);
  const W = p.larguraBase, D = p.profBase, hB = p.alturaBase, e = p.espessura, f = p.folga;
  const rasgo = C.square([p.larguraHaste + 2 * f, e + 2 * f], true).translate([0, L.yRasgo]).extrude(p.profEncaixe + 1).translate([0, 0, hB - p.profEncaixe]);
  let base = retArred(W, D, p.raioBase).extrude(hB).subtract(rasgo);
  const partesBase = [];
  const relevo = (cs, id) => {
    if (!cs) return;
    if (p.acabamento === 'rente') {
      const pr = Math.min(p.relevo, hB - 1);
      base = base.subtract(cs.extrude(pr + 0.01).translate([0, 0, hB - pr]));
      partesBase.push([id, cs.extrude(pr).translate([0, 0, hB - pr])]);
    } else partesBase.push([id, cs.extrude(p.relevo).translate([0, 0, hB])]);
  };
  relevo(L.texto, 'texto'); relevo(L.arte, 'arte');
  partesBase.unshift(['base', base]);
  const figura = L.figura.extrude(e);
  const fb = figura.boundingBox();
  const imprimir = [...partesBase, ['haste', figura.translate([W / 2 + 10 - fb.min[0], -(fb.min[1] + fb.max[1]) / 2, 0])]];
  // montado: haste em pé no rasgo (plano XZ), espessura centrada no rasgo
  const emPe = figura.translate([0, 0, -e / 2]).rotate([90, 0, 0]).translate([0, L.yRasgo, hB]);
  return { montado: [...partesBase, ['haste', emPe]], imprimir, L };
}

// ---------------- Luminária lithophane (foto em relevo de espessura, ou nome/arte em camadas) ----------------
// foto: ImageData (escuro = grosso = aparece escuro com luz atrás). Ou formas 2D (texto/arte) em 2 níveis.
function malhaAlturas(W, H, cols, rows, alturaEm) {
  // grade superior (z = espessura) + fundo plano + laterais: sólido fechado
  const nV = cols * rows, pos = new Float32Array(nV * 2 * 3), tri = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, x = -W / 2 + W * i / (cols - 1), y = H / 2 - H * j / (rows - 1);
    pos.set([x, y, alturaEm(i, j)], k * 3); pos.set([x, y, 0], (nV + k) * 3);
  }
  const t = (j, i) => j * cols + i, b = (j, i) => nV + j * cols + i;
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    tri.push(t(j, i), t(j + 1, i), t(j, i + 1), t(j, i + 1), t(j + 1, i), t(j + 1, i + 1));        // topo (normal +z)
    tri.push(b(j, i), b(j, i + 1), b(j + 1, i), b(j, i + 1), b(j + 1, i + 1), b(j + 1, i));        // fundo (normal -z)
  }
  const lado = (a, c, d, e) => tri.push(a, c, d, d, c, e);
  for (let i = 0; i < cols - 1; i++) {
    lado(t(0, i + 1), b(0, i + 1), t(0, i), b(0, i));                        // borda de cima (y+)
    lado(t(rows - 1, i), b(rows - 1, i), t(rows - 1, i + 1), b(rows - 1, i + 1));  // borda de baixo
  }
  for (let j = 0; j < rows - 1; j++) {
    lado(t(j, 0), b(j, 0), t(j + 1, 0), b(j + 1, 0));                          // esquerda
    lado(t(j + 1, cols - 1), b(j + 1, cols - 1), t(j, cols - 1), b(j, cols - 1));  // direita
  }
  const Man = M().Manifold, Mesh = M().Mesh;
  return new Man(new Mesh({ numProp: 3, vertProperties: pos, triVerts: new Uint32Array(tri) }));
}

export function geoLitofania(fonte, p) {
  const Man = M().Manifold, C = CS();
  const W = p.largura, H = p.altura, b = p.moldura, eMin = p.espMin, eMax = p.espMax;
  const Wi = W - 2 * b, Hi = H - 2 * b;
  let painel;
  if (fonte.imagem) {
    const img = fonte.imagem, res = p.resolucao;
    // legenda embaixo da foto: uma faixa com o nome em camadas (porta-retrato com nome)
    const hL = fonte.legenda ? p.alturaLegenda + 6 : 0;
    const HiF = Hi - hL;
    const cols = Math.max(2, Math.round(Wi / res) + 1), rows = Math.max(2, Math.round(HiF / res) + 1);
    // recorta a foto no formato do painel (preenche, sem distorcer)
    const ar = Wi / HiF, ia = img.width / img.height;
    const cw = ia > ar ? img.height * ar : img.width, ch = ia > ar ? img.height : img.width / ar;
    const ox = (img.width - cw) / 2, oy = (img.height - ch) / 2;
    const lum = (x, y) => {
      const px = Math.min(img.width - 1, Math.max(0, Math.round(ox + x * (cw - 1)))), py = Math.min(img.height - 1, Math.max(0, Math.round(oy + y * (ch - 1))));
      const o = (py * img.width + px) * 4, d = img.data;
      const l = (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
      return d[o + 3] < 10 ? 1 : l;
    };
    const gama = p.contraste;
    painel = malhaAlturas(Wi + 0.02, HiF + (hL ? 0.4 : 0.02), cols, rows, (i, j) => {
      let l = lum(i / (cols - 1), j / (rows - 1));
      if (p.inverter) l = 1 - l;
      return eMin + (eMax - eMin) * Math.pow(1 - l, gama);
    }).translate([0, hL / 2, 0]);
    if (hL) {
      const faixa = C.square([Wi + 0.02, hL], true).translate([0, -Hi / 2 + hL / 2]);
      const lb = fonte.legenda.bounds();
      const esc = Math.min((Wi - 6) / (lb.max[0] - lb.min[0]), p.alturaLegenda / (lb.max[1] - lb.min[1]));
      const txt = fonte.legenda.scale([esc, esc]); const tb = txt.bounds();
      const t = txt.translate([-(tb.min[0] + tb.max[0]) / 2, -Hi / 2 + hL / 2 - (tb.min[1] + tb.max[1]) / 2]).intersect(faixa);
      // nome escuro (grosso) num fundo claro (fino)
      painel = Man.union([painel, faixa.extrude(eMin), t.extrude(eMax)]);
    }
  } else {
    // nome/arte em camadas: fundo fino (claro com luz) e o desenho grosso (escuro) — ou o contrário
    const area = C.square([Wi, Hi], true);
    let des = fonte.forma ? fonte.forma.intersect(area.offset(-0.5)) : null;
    if (des && p.engrossar > 0) des = des.offset(p.engrossar, 'Round', 2, 24).intersect(area);
    if (p.inverter && des) painel = Man.union([area.extrude(eMax).subtract(des.extrude(eMax - eMin + 0.01).translate([0, 0, eMin])), ]);
    else painel = des ? Man.union([area.extrude(eMin), des.extrude(eMax)]) : area.extrude(eMin);
  }
  const espTotal = Math.max(eMax, p.espMoldura);
  const moldura = retArred(W, H, p.raio).subtract(C.square([Wi - 0.01, Hi - 0.01], true)).extrude(espTotal);
  const placa = Man.union([moldura, painel]);
  const B = baseApoio(W, espTotal, { folgaBase: p.folgaBase, profBase: p.profBase, altBase: p.altBase });
  // montado: placa em pé no rasgo da base (base de volta pro centro)
  const dxBase = W / 2 + B.baseL / 2 + 8;
  const emPe = placa.translate([0, 0, -espTotal / 2]).rotate([90, 0, 0]).translate([0, 0, H / 2 + 3]);
  return {
    imprimir: [['placa', placa], ['base', B.base]],
    montado: [['placa', emPe], ['base', B.base.translate([-dxBase, 0, 0])]],
    espTotal, fenda: B.fenda,
  };
}

// ---------------- Placa de informações (ícone + linha principal grande + linhas menores; formatos e furos) ----------------
// partes: { arte?: cs, principal?: cs, linhas: [cs] }
export function layoutPlacaInfo(partes, p) {
  const C = CS();
  const blocos = [];
  const add = (cs, w, h) => { if (cs) blocos.push(caber(cs, w, h)); };
  add(partes.arte, p.tamArte, p.tamArte);
  add(partes.principal, p.larguraTexto, p.alturaPrincipal);
  for (const l of partes.linhas || []) add(l, p.larguraTexto * 0.9, p.alturaLinhas);
  if (!blocos.length) throw new Error('Digite algum texto.');
  // empilha centralizado
  let y = 0; const pos = [];
  blocos.forEach((cs, i) => { const b = cs.bounds(); pos.push(cs.translate([-(b.min[0] + b.max[0]) / 2, y - b.max[1]])); y -= (b.max[1] - b.min[1]) + (i === 0 && partes.arte ? p.espaco * 1.4 : p.espaco); });
  let conteudo = C.union(pos);
  const bc = conteudo.bounds();
  conteudo = conteudo.translate([0, -(bc.min[1] + bc.max[1]) / 2 + p.conteudoY]);
  const b = conteudo.bounds(), w = b.max[0] - b.min[0] + 2 * p.margem, h = b.max[1] - b.min[1] + 2 * p.margem;
  let base;
  if (p.forma === 'oval') base = C.circle(0.5, 128).scale([w * 1.12, h * 1.12]);
  else if (p.forma === 'circulo') base = C.circle(Math.hypot(w, h) / 2 * 0.92, 128);
  else if (p.forma === 'nuvem') {
    const r = h * 0.32;
    base = C.union([C.square([w, h * 0.62], true).translate([0, -h * 0.12]),
      C.circle(r, 64).translate([-w * 0.3, h * 0.12]), C.circle(r * 1.25, 64).translate([0, h * 0.2]), C.circle(r, 64).translate([w * 0.3, h * 0.12]),
      C.circle(h * 0.31, 64).translate([-w / 2, -h * 0.12]), C.circle(h * 0.31, 64).translate([w / 2, -h * 0.12])]).offset(2, 'Round', 2, 48).offset(-2, 'Round', 2, 48);
  } else if (p.forma === 'contorno') {
    base = preencherBuracos(preencherBuracos(conteudo.offset(p.margem * 0.6 + 3, 'Round', 2, 40)).offset(-3, 'Round', 2, 40).offset(p.borda, 'Round', 2, 40));
  } else base = retArred(w, h, p.raio);
  if (p.forma !== 'contorno' && p.moldura > 0) {
    // moldura em relevo: anel na borda
    base._moldura = base.subtract(base.offset(-p.moldura, 'Round', 2, 48));
  }
  // furos: 2 em cima (pendurar) ou 4 cantos (parafuso)
  const bb = base.bounds(), furos = [];
  const dentro = (x, y) => !base.offset(-(p.furo / 2 + 2), 'Round', 2, 32).intersect(C.square([0.05, 0.05], true).translate([x, y])).isEmpty();
  const procurar = (x, y, dx, dy) => { for (let k = 0; k < 80; k++) { if (dentro(x, y)) return [x, y]; x += dx; y += dy; } return null; };
  if (p.furos === 'pendurar') for (const s of [-1, 1]) { const f = procurar(s * (bb.max[0] - bb.min[0]) * 0.3, bb.max[1], 0, -0.5); if (f) furos.push(f); }
  if (p.furos === 'parafuso') for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const f = procurar(sx * bb.max[0], sy * bb.max[1], -sx * 0.5, -sy * 0.5); if (f) furos.push(f); }
  if (p.furos === 'centro') { const f = procurar(0, bb.max[1], 0, -0.5); if (f) furos.push(f); }
  const vazios = furos.length ? C.union(furos.map(([x, y]) => C.circle(p.furo / 2, 48).translate([x, y]))) : null;
  if (vazios) conteudo = conteudo.subtract(vazios.offset(1.2, 'Round', 2, 32));
  const moldura = base._moldura ? (vazios ? base._moldura.subtract(vazios.offset(1, 'Round', 2, 32)) : base._moldura) : null;
  if (vazios) base = base.subtract(vazios);
  const bf = base.bounds();
  return { base, conteudo, moldura, vazios, furos, larg: bf.max[0] - bf.min[0], alt: bf.max[1] - bf.min[1] };
}

export function geoPlacaInfo(partes, p) {
  const Man = M().Manifold;
  const L = layoutPlacaInfo(partes, p);
  const e = p.espBase;
  let base = L.base.extrude(e);
  const pecas = [];
  if (p.acabamento === 'rente') {
    const pr = Math.min(p.relevo, e - 0.8);
    base = base.subtract(L.conteudo.extrude(pr + 0.01).translate([0, 0, e - pr]));
    pecas.push(['conteudo', L.conteudo.extrude(pr).translate([0, 0, e - pr])]);
  } else pecas.push(['conteudo', L.conteudo.extrude(p.relevo).translate([0, 0, e])]);
  if (L.moldura) pecas.push(['moldura', L.moldura.extrude(p.relevoMoldura).translate([0, 0, e])]);
  // furo de parafuso escareado (cabeça embutida) na face de cima
  if (L.vazios && p.furos === 'parafuso' && p.escarear) {
    const Ccs = CS();
    for (const [x, y] of L.furos) base = base.subtract(Man.cylinder(Math.min(e, 3), p.furo / 2, p.furo / 2 + 2.5, 48).translate([x, y, e - Math.min(e, 3) + 0.01]));
  }
  return { partes: [['base', semLascas(base)], ...pecas], L, alturaTotal: e + Math.max(p.acabamento === 'rente' ? 0 : p.relevo, L.moldura ? p.relevoMoldura : 0) };
}

// ---------------- Suporte de mesa (celular/tablet/controle): perfil lateral extrudado + nome na frente ----------------
export function perfilSuporteMesa(p) {
  const C = CS(), e = p.espessura, a = p.angulo * Math.PI / 180;
  // barra grossa entre dois pontos (com pontas arredondadas)
  const barra = ([x1, y1], [x2, y2]) => {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l * e / 2, ny = dx / l * e / 2;
    return poli([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]])
      .add(C.circle(e / 2, 24).translate([x1, y1])).add(C.circle(e / 2, 24).translate([x2, y2]));
  };
  const D = p.profundidade;
  const chao = C.square([D, e], false);
  const aba = C.square([e, p.alturaLabio + e], false).translate([D - e, 0]);
  // encosto: sai do chão logo atrás do vão do aparelho e sobe inclinado pra trás
  const p0 = [D - e - p.vao - e / 2, e / 2];
  const L = p.alturaEncosto / Math.sin(a);
  const p1 = [p0[0] - L * Math.cos(a), p0[1] + L * Math.sin(a)];
  const encosto = barra(p0, p1);
  // escora: do fundo do chão até o meio do encosto (não deixa tombar)
  const pm = [p0[0] + (p1[0] - p0[0]) * 0.55, p0[1] + (p1[1] - p0[1]) * 0.55];
  const xFundo = Math.min(p1[0], 0) + e / 2;
  const escora = barra([Math.max(e / 2, xFundo), e / 2], pm);
  let perfil = C.union([chao, aba, encosto, escora]);
  const bb = perfil.bounds();
  perfil = perfil.translate([-bb.min[0], 0]).offset(0.8, 'Round', 2, 24).offset(-0.8, 'Round', 2, 24);
  return { perfil, frenteX: D - bb.min[0], alturaLabio: p.alturaLabio + e };
}

export function geoSuporteMesa(partes, p) {
  const Man = M().Manifold, C = CS();
  const { perfil, frenteX, alturaLabio } = perfilSuporteMesa(p);
  let corpo = perfil.extrude(p.largura);                                          // deitado: perfil na mesa, largura em Z
  // furo/rasgo pro cabo no meio do chão
  // rasgo do cabo: canal no chão, do vão do aparelho até a traseira (não corta a aba da frente nem o nome)
  if (p.furoCabo > 0) {
    const xFim = frenteX - p.espessura - 0.8;
    corpo = corpo.subtract(Man.cube([xFim + 1, p.espessura + 1.01, p.furoCabo]).translate([-1, -1, p.largura / 2 - p.furoCabo / 2]));
  }
  const pecas = [['corpo', corpo]];
  if (partes.texto) {
    // nome na face da frente da aba (plano x = frenteX), lido de frente
    const area = [p.largura - 6, alturaLabio - 3];
    const t = caber(partes.texto, area[0], Math.min(area[1], p.alturaTexto)), b = t.bounds();
    const tc = t.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]);
    const rel = tc.extrude(p.relevo).rotate([0, 90, 0]).translate([frenteX, alturaLabio / 2, p.largura / 2]);
    pecas.push(['texto', rel]);
  }
  // montado (em pé, como fica na mesa): Y do perfil vira Z
  const montado = pecas.map(([id, m]) => [id, m.rotate([90, 0, 0])]);
  return { imprimir: pecas, montado };
}

// ================= LOTE 3: porta-saquinho, placa Aberto/Fechado, divisor de gaveta, skyline, ponteira =================
const extr = (cs, z0, z1) => cs.extrude(z1 - z0).translate([0, 0, z0]);
const cent = cs => { const b = cs.bounds(); return cs.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]); };

// ---- Porta-saquinho (dispenser de sacolinha): tubo com furo embaixo + tampa de encaixe com alça e nome embutido ----
export function geoPortaSaquinho(partes, p) {
  const Man = M().Manifold, C = CS();
  const Ro = p.diametro / 2, Ri = Ro - p.parede, H = p.altura, fundo = 2;
  let corpo = Man.cylinder(H, Ro, Ro, 96).subtract(Man.cylinder(H, Ri, Ri, 96).translate([0, 0, fundo]));
  corpo = corpo.subtract(Man.cylinder(fundo + 2, p.furoSaida / 2, p.furoSaida / 2, 64).translate([0, 0, -1]));
  // tampa: disco + anel que entra no tubo (folga) + alça lateral pra guia; impressa com a face do nome na mesa
  const eT = 3, rAnel = Ri - p.folga;
  const disco = C.circle(Ro, 96);
  const alca = C.circle(p.alca / 2 + 3, 48).translate([Ro + p.alca / 2 + 1, 0]).add(C.square([p.alca / 2 + 6, (p.alca / 2 + 3) * 1.6], true).translate([Ro + 1, 0]))
    .subtract(C.circle(p.alca / 2, 48).translate([Ro + p.alca / 2 + 1, 0]));
  let tampa = extr(disco.add(alca), 0, eT).add(extr(C.circle(rAnel, 96).subtract(C.circle(rAnel - 1.6, 96)), eT, eT + 7));
  const pecas = [];
  if (partes.texto) {
    // nome embutido (nivelado) na face da tampa que fica pra fora — essa face vai pra mesa, então espelhado
    const t = cent(caber(partes.texto, Ro * 1.55, Ro * 0.9)).mirror([1, 0]).intersect(C.circle(Ro - 1.5, 96));
    tampa = tampa.subtract(extr(t, -0.01, 0.6));
    pecas.push(['texto', extr(t, 0, 0.6).translate([Ro * 2 + 14, 0, 0])]);
  }
  pecas.unshift(['corpo', corpo], ['tampa', tampa.translate([Ro * 2 + 14, 0, 0])]);
  const montado = [['corpo', corpo], ['tampa', tampa.rotate([180, 0, 0]).translate([0, 0, H + eT])]];
  if (pecas.find(x => x[0] === 'texto')) montado.push(['texto', pecas.find(x => x[0] === 'texto')[1].translate([-(Ro * 2 + 14), 0, 0]).rotate([180, 0, 0]).translate([0, 0, H + eT])]);
  return { imprimir: pecas, montado };
}

// ---- Placa Aberto/Fechado giratória: painel que gira dentro da moldura em 2 pinos (impresso no lugar) ----
export function geoPlacaGiratoria(partes, p) {
  const Man = M().Manifold, C = CS();
  const W = p.largura, H = p.altura, e = p.espessura, m = p.moldura, g = p.folga;
  const Wp = W - 2 * m - 2 * g, Hp = H - 2 * m - 2 * g, zc = e / 2, rp = p.pino / 2, c = p.folgaPino;
  const externo = retArred(W, H, p.raio), vao = retArred(W - 2 * m, H - 2 * m, Math.max(p.raio - m, 1));
  // alças de pendurar em cima
  const furos = [-1, 1].map(s => C.circle(2.5, 32).translate([s * W * 0.3, H / 2 - m / 2]));
  let moldura = extr(externo.subtract(vao).subtract(C.union(furos)), 0, e);
  let painel = extr(retArred(Wp, Hp, Math.max(p.raio - m - g, 1)), 0, e);
  // pinos: saem do painel (em cima e embaixo) e entram em furos da moldura; eixo vertical (Y) no meio da espessura
  const cilY = (y0, y1, r) => Man.cylinder(y1 - y0, r, r, 32).rotate([-90, 0, 0]).translate([0, y0, zc]);
  const yTopo = Hp / 2, entra = m * 0.7;
  for (const s of [1, -1]) {
    const a = s > 0 ? yTopo - 1 : -yTopo - g - entra, b = s > 0 ? yTopo + g + entra : -yTopo + 1;
    painel = painel.add(cilY(a, b, rp));
    const fa = s > 0 ? yTopo + 0.01 : -yTopo - g - entra - 0.4, fb = s > 0 ? yTopo + g + entra + 0.4 : -yTopo - 0.01;
    moldura = moldura.subtract(cilY(fa, fb, rp + c));
  }
  const pecas = [['moldura', moldura], ['painel', painel]];
  const area = [Wp - 6, Hp - 6];
  if (partes.frente) { const t = cent(caber(partes.frente, area[0], Math.min(area[1], p.alturaTexto))); pecas.push(['frente', extr(t, e, e + p.relevo)]); }
  if (partes.verso) {
    // verso embutido no fundo, espelhado: aparece certo quando o painel gira 180°
    const t = cent(caber(partes.verso, area[0], Math.min(area[1], p.alturaTexto))).mirror([1, 0]);
    pecas[1][1] = pecas[1][1].subtract(extr(t, -0.01, p.profVerso));
    pecas.push(['verso', extr(t, 0, p.profVerso)]);
  }
  return { partes: pecas };
}

// ---- Divisor de gaveta com nome ----
export function geoDivisor(partes, p) {
  const C = CS();
  const L = p.comprimento, H = p.altura, e = p.espessura;
  let perfil = retArred(L, H, Math.min(p.raio, H / 2 - 0.1));
  // pega-mão no meio de cima (recorte)
  if (p.pegador > 0) perfil = perfil.subtract(C.circle(p.pegador / 2, 64).scale([1.6, 1]).translate([0, H / 2]));
  // encaixes nas pontas (pra trilho/ranhura do organizador)
  if (p.encaixe > 0) for (const s of [-1, 1]) perfil = perfil.subtract(C.square([p.encaixe * 2, H * p.encaixeAltura], true).translate([s * L / 2, -H / 2]));
  const pecas = [['divisor', extr(perfil, 0, e)]];
  if (partes.texto) {
    const t = cent(caber(partes.texto, L * 0.8, Math.min(p.alturaTexto, H * 0.6))).translate([0, p.textoY]);
    pecas.push(['texto', extr(t.intersect(perfil.offset(-1.5)), e, e + p.relevo)]);
  }
  return { partes: pecas };
}

// ---- Skyline: prédios (gerados ou SVG do usuário) + nome da cidade, em pé na base ----
export function skylineGerado(W, H, seed, densidade) {
  const C = CS();
  let s = seed >>> 0 || 1; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const formas = []; let x = -W / 2;
  while (x < W / 2) {
    const w = (6 + rnd() * 14) * (1.3 - densidade * 0.6), h = H * (0.25 + rnd() * 0.75);
    let pr = C.square([w, h], false).translate([x, 0]);
    const t = rnd();
    if (t < 0.18) pr = pr.add(poli([[x, h], [x + w, h], [x + w / 2, h + w * 0.6]]));                        // telhado pontudo
    else if (t < 0.32) pr = pr.add(C.square([1.2, h * 0.18], false).translate([x + w / 2 - 0.6, h]));     // antena
    else if (t < 0.42) pr = pr.add(C.circle(w / 2, 32).translate([x + w / 2, h]));                        // cúpula
    formas.push(pr);
    x += w * (0.75 + rnd() * 0.3);
  }
  return C.union(formas).intersect(C.square([W, H * 1.6], false).translate([-W / 2, 0]));
}

export function geoSkyline(partes, p) {
  const Man = M().Manifold, C = CS();
  const W = p.largura, e = p.espessura;
  let predios = partes.arte ? caber(partes.arte, W, p.alturaPredios) : skylineGerado(W, p.alturaPredios, p.semente, p.densidade);
  const pb = predios.bounds();
  predios = predios.translate([-(pb.min[0] + pb.max[0]) / 2, -pb.min[1]]);
  const faixaH = p.alturaFaixa;
  const faixa = retArred(W + 2 * p.margem, faixaH, Math.min(3, faixaH / 2 - 0.1)).translate([0, -faixaH / 2 + 0.5]);
  // aba de encaixe embaixo da faixa: é ela que entra no rasgo da base (assim o nome fica todo à vista, acima da base)
  const profRasgo = Math.max(p.altBase, 8) - 3;
  const fb0 = faixa.bounds();
  const aba = C.square([W + 2 * p.margem, profRasgo + 0.5], false).translate([-(W + 2 * p.margem) / 2, fb0.min[1] - profRasgo]);
  let silhueta = predios.add(faixa).add(aba);
  if (p.janelas) {
    // janelinhas vazadas nos prédios (luz passa com LED atrás)
    const jan = [];
    for (let y = 4; y < p.alturaPredios - 3; y += p.passoJanela) for (let x = -W / 2 + 3; x < W / 2 - 3; x += p.passoJanela)
      jan.push(C.square([p.passoJanela * 0.45, p.passoJanela * 0.55], true).translate([x, y]));
    if (jan.length) silhueta = silhueta.subtract(C.union(jan).intersect(predios.offset(-1.6, 'Miter', 2)));
  }
  const pecas = [['skyline', extr(silhueta, 0, e)]];
  if (partes.texto) {
    const t = cent(caber(partes.texto, W * 0.9, faixaH - 4)).translate([0, -faixaH / 2 + 0.5]);
    pecas.push(['texto', extr(t, e, e + p.relevo)]);
  }
  const bb = silhueta.bounds(), Hs = bb.max[1] - bb.min[1];
  const B = baseApoio(W + 2 * p.margem, e + p.relevo, { folgaBase: p.folgaBase, profBase: p.profBase, altBase: p.altBase });
  const imprimir = [...pecas, ['base', B.base]];
  // montado: em pé no rasgo da base
  const emPe = m => m.translate([0, -bb.min[1], -(e + p.relevo) / 2]).rotate([90, 0, 0]).translate([0, 0, 3]);
  const dx = (W + 2 * p.margem) / 2 + B.baseL / 2 + 8;
  const montado = [...pecas.map(([id, m]) => [id, emPe(m)]), ['base', B.base.translate([-dx, 0, 0])]];
  return { imprimir, montado, altura: Hs };
}

// ---- Ponteira de caneta: logo chapado + encaixe tubular deitado (furo horizontal pro corpo da caneta), em lote ----
export function geoPonteira(partes, p) {
  const Man = M().Manifold, C = CS();
  const F = formaDaArte(partes.arte, { tamanho: p.tamanho, rotArte: 0, borda: p.borda, fecho: 1.5 });
  const bb = F.base.bounds();
  const cx = (bb.min[0] + bb.max[0]) / 2;
  const base = F.base.translate([-cx, -bb.min[1]]), arte = F.arte.translate([-cx, -bb.min[1]]);
  const e = p.espessura, Ro = p.diamCaneta / 2 + p.parede, L = p.encaixe;
  // tubo deitado ao longo de -Y, encostado embaixo do logo; furo cego do diâmetro da caneta
  const tubo = Man.cylinder(L + 2, Ro, Ro, 48).rotate([90, 0, 0]).translate([0, 2, Ro]);
  const furo = Man.cylinder(L, p.diamCaneta / 2 + p.folga, p.diamCaneta / 2 + p.folga, 48).rotate([90, 0, 0]).translate([0, -2, Ro]);
  // achata a base do tubo pra aderir na mesa
  let corpo = extr(base, 0, e).add(tubo).subtract(furo).intersect(Man.cube([1e4, 1e4, 1e4], true).translate([0, 0, 5e3 + 0.0]));
  const um = { corpo, arte: extr(arte.subtract(C.square([Ro * 2 + 1, 6], true).translate([0, 3])), e, e + p.relevo) };
  const ub = corpo.boundingBox(), w = ub.max[0] - ub.min[0] + p.espacoLote, h = ub.max[1] - ub.min[1] + p.espacoLote;
  const n = Math.max(1, Math.round(p.quantidade)), cols = Math.max(1, Math.min(n, Math.floor(p.mesa / w)));
  const linhas = Math.ceil(n / cols), cabem = Math.min(n, cols * Math.max(1, Math.floor(p.mesa / h)));
  const pos = []; for (let i = 0; i < cabem; i++) pos.push([(i % cols - (cols - 1) / 2) * w, (Math.floor(i / cols) - (Math.min(linhas, Math.ceil(cabem / cols)) - 1) / 2) * h]);
  const juntar = m => Man.compose(pos.map(([x, y]) => m.translate([x, y, 0])));
  return { partes: [['corpo', juntar(um.corpo)], ['arte', juntar(um.arte)]], cabem, pedidas: n, unidade: [ub.max[0] - ub.min[0], ub.max[1] - ub.min[1]] };
}

export { caber, poli, malhaAlturas, semLascas, extr, cent };
