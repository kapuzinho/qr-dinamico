// Projeta uma forma 2D na superfície real da peça (raycast por vértice) e funde ou entalha
import * as THREE from 'three';
import { caixa, criarTestador } from './motor.js';

// eixos da tela em cada vista: U = direita, V = cima, W = pra fora (em direção à câmera)
const BASES = {
  cima: [[1, 0, 0], [0, 1, 0]], baixo: [[1, 0, 0], [0, -1, 0]],
  frente: [[1, 0, 0], [0, 0, 1]], tras: [[-1, 0, 0], [0, 0, 1]],
  esquerda: [[0, -1, 0], [0, 0, 1]], direita: [[0, 1, 0], [0, 0, 1]],
};
export function baseDaVista(vista) {
  const U = new THREE.Vector3(...BASES[vista][0]), V = new THREE.Vector3(...BASES[vista][1]);
  const W = new THREE.Vector3().crossVectors(U, V);
  return { U, V, W, D: W.clone().negate() };
}

// base a partir da normal da face clicada: W = normal; "cima" do desenho aponta pro +Z (em paredes) ou +Y (em faces deitadas)
export function baseDaNormal(n) {
  const W = new THREE.Vector3(...(n.toArray ? n.toArray() : n)).normalize();
  const ref = Math.abs(W.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, W.z > 0 ? 1 : -1, 0);
  const V = ref.sub(W.clone().multiplyScalar(ref.dot(W))).normalize();
  const U = new THREE.Vector3().crossVectors(V, W).normalize();
  return { U, V, W, D: W.clone().negate() };
}

export function carimbar(man, geomPeca, cs, { vista, base, ponto, modo = 'relevo', altura = 1, prof = 0.8, afundar = 0.6, separado = false }) {
  const { U, V, W, D } = base || baseDaVista(vista);
  const b = caixa(man);
  const diag = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
  const bb = cs.bounds();
  const lado = Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1]);
  const busca = Math.min(diag + 5, Math.max(10, lado * 1.5)); // alcance do raio proporcional ao carimbo
  const passo = Math.max(0.3, Math.min(1.5, lado / 90));
  const t = criarTestador(geomPeca);
  const cache = new Map();
  const O = new THREE.Vector3();
  const espessura = modo === 'relevo' ? altura + afundar : prof + 1;
  const inicio = modo === 'relevo' ? -afundar : -prof;
  const prisma = cs.extrude(1).refineToLength(passo);
  const warped = prisma.warp(v => {
    const k = `${Math.round(v[0] * 1e4)}|${Math.round(v[1] * 1e4)}`;
    let s = cache.get(k);
    if (!s) {
      O.copy(ponto).addScaledVector(U, v[0]).addScaledVector(V, v[1]).addScaledVector(W, busca);
      const d = t.primeiro(O, D);
      s = d !== null && d < busca * 2 ? O.clone().addScaledVector(D, d) : ponto.clone().addScaledVector(U, v[0]).addScaledVector(V, v[1]);
      cache.set(k, s);
    }
    const h = inicio + v[2] * espessura;
    v[0] = s.x + W.x * h;
    v[1] = s.y + W.y * h;
    v[2] = s.z + W.z * h;
  });
  prisma.delete();
  t.liberar();
  // calcula sempre as duas formas: fundida (vira a peça aberta) e separada (pros downloads .zip/.3mf)
  const r = { liberar() { for (const m of new Set([warped, r.final, r.detalhe, r.pecaSeparada])) if (m && m !== man) m.delete(); } };
  if (modo === 'relevo') { r.final = man.add(warped); r.pecaSeparada = man; r.detalhe = warped.subtract(man); }
  else { r.final = man.subtract(warped); r.pecaSeparada = r.final; r.detalhe = warped.intersect(man); }
  return r;
}
