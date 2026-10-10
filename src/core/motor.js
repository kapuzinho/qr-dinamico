// Motor geométrico: manifold-3d (WebAssembly) + utilidades de malha em Three.js
import * as THREE from 'three';
import Module from 'manifold-3d';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let wasm = null;
export const M = () => wasm;

export async function iniciarMotor(urlWasm = '/manifold.wasm') {
  wasm = await Module({ locateFile: () => urlWasm });
  wasm.setup();
}

export const VETOR = {
  '+x': [1, 0, 0], '-x': [-1, 0, 0],
  '+y': [0, 1, 0], '-y': [0, -1, 0],
  '+z': [0, 0, 1], '-z': [0, 0, -1],
};
// direção em que o furo/carimbo entra na peça, pra cada vista
export const DIR_DA_VISTA = { cima: '-z', baixo: '+z', frente: '+y', tras: '-y', esquerda: '+x', direita: '-x' };
export const OPCOES_VISTA = [
  ['cima', 'De cima'], ['frente', 'De frente'], ['tras', 'De trás'],
  ['esquerda', 'Da esquerda'], ['direita', 'Da direita'], ['baixo', 'De baixo'],
];
// rotação (graus) que leva um cilindro em +Z pra cada direção
const ROT = {
  '+z': [0, 0, 0], '-z': [180, 0, 0],
  '+x': [0, 90, 0], '-x': [0, -90, 0],
  '+y': [-90, 0, 0], '-y': [90, 0, 0],
};

export function paraManifold(geom) {
  if (!geom.index) throw new Error('A malha precisa ser indexada.');
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: new Float32Array(geom.attributes.position.array),
    triVerts: new Uint32Array(geom.index.array),
  });
  mesh.merge();
  try {
    return new wasm.Manifold(mesh);
  } catch {
    throw new Error('A malha não está fechada (tem furos ou faces soltas). Rode a ferramenta Reparar primeiro.');
  }
}

export function paraGeometria(man) {
  const mesh = man.getMesh();
  const n = mesh.numProp, vp = mesh.vertProperties;
  let pos;
  if (n === 3) pos = new Float32Array(vp);
  else {
    const nv = vp.length / n;
    pos = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) { pos[i * 3] = vp[i * n]; pos[i * 3 + 1] = vp[i * n + 1]; pos[i * 3 + 2] = vp[i * n + 2]; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.triVerts), 1));
  g.computeBoundingBox();
  return g;
}

export function caixa(man) {
  const b = man.boundingBox();
  const v = x => (x.length !== undefined ? [x[0], x[1], x[2]] : [x.x, x.y, x.z]);
  return { min: v(b.min), max: v(b.max) };
}
export const volumeDe = m => (typeof m.volume === 'function' ? m.volume() : m.getProperties().volume);
export const areaDe = m => (typeof m.surfaceArea === 'function' ? m.surfaceArea() : m.getProperties().surfaceArea);
export const combinar = lista => (wasm.Manifold.compose ? wasm.Manifold.compose(lista) : wasm.Manifold.union(lista));

export function cilindro(dir, r, comp, inicio, seg = 48) {
  return wasm.Manifold.cylinder(comp, r, r, seg, false).rotate(ROT[dir]).translate(inicio);
}
export function cilindroEixo(eixo, r, a, b, centro) {
  const ini = [...centro];
  ini[eixo] = a;
  return cilindro(['+x', '+y', '+z'][eixo], r, b - a, ini);
}

export function furar(m, ponto, dirNome, r, { passante = true, prof = 10 } = {}) {
  const v = VETOR[dirNome], b = caixa(m);
  const diag = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) + 10;
  const [ini, comp] = passante ? [-diag, 2 * diag] : [-1, prof + 1];
  const inicio = [ponto.x + v[0] * ini, ponto.y + v[1] * ini, ponto.z + v[2] * ini];
  const c = cilindro(dirNome, r, comp, inicio, 64);
  const res = m.subtract(c);
  c.delete();
  return res;
}

// centraliza em XY na mesa e apoia em Z=0
export function assentar(g, mesa) {
  g.computeBoundingBox();
  const b = g.boundingBox;
  const d = [mesa.x / 2 - (b.min.x + b.max.x) / 2, mesa.y / 2 - (b.min.y + b.max.y) / 2, -b.min.z];
  g.translate(d[0], d[1], d[2]);
  g.computeBoundingBox();
  g.userData.deslocamento = d;
  return g;
}

// monta geometria só com os vértices usados
export function geometriaCompacta(pos, idx) {
  const mapa = new Int32Array(pos.length / 3).fill(-1);
  const novasPos = [], novoIdx = new Uint32Array(idx.length);
  let n = 0;
  for (let i = 0; i < idx.length; i++) {
    const v = idx[i];
    if (mapa[v] < 0) { mapa[v] = n++; novasPos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
    novoIdx[i] = mapa[v];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(novasPos, 3));
  g.setIndex(new THREE.BufferAttribute(novoIdx, 1));
  g.computeBoundingBox();
  return g;
}

export function dadosFaces(g) {
  const p = g.attributes.position.array, idx = g.index.array, n = idx.length / 3;
  const normais = new Float32Array(n * 3), centros = new Float32Array(n * 3), areas = new Float32Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = idx[i * 3] * 3, b = idx[i * 3 + 1] * 3, c = idx[i * 3 + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    areas[i] = l / 2; total += l / 2;
    if (l > 0) { nx /= l; ny /= l; nz /= l; }
    normais[i * 3] = nx; normais[i * 3 + 1] = ny; normais[i * 3 + 2] = nz;
    centros[i * 3] = (p[a] + p[b] + p[c]) / 3;
    centros[i * 3 + 1] = (p[a + 1] + p[b + 1] + p[c + 1]) / 3;
    centros[i * 3 + 2] = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
  }
  return { n, normais, centros, areas, total };
}

export function contarBordas(g) {
  const idx = g.index.array, N = g.attributes.position.count;
  const mapa = new Map();
  const add = (u, v) => { const k = u < v ? u * N + v : v * N + u; mapa.set(k, (mapa.get(k) || 0) + 1); };
  for (let i = 0; i < idx.length; i += 3) { add(idx[i], idx[i + 1]); add(idx[i + 1], idx[i + 2]); add(idx[i + 2], idx[i]); }
  let abertas = 0, naoManifold = 0;
  for (const c of mapa.values()) { if (c === 1) abertas++; else if (c > 2) naoManifold++; }
  return { abertas, naoManifold };
}

// raycast acelerado (BVH): teste de ponto dentro da peça e medições de espessura
export function criarTestador(geom) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geom.attributes.position);
  g.setIndex(new THREE.BufferAttribute(geom.index.array.slice(), 1)); // cópia: a BVH reordena o índice
  g.computeBoundsTree();
  const malha = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const rc = new THREE.Raycaster();
  const dirTeste = new THREE.Vector3(0.5413, 0.6112, 0.5773).normalize();
  const todos = (o, d) => {
    rc.firstHitOnly = false;
    rc.set(o, d);
    const out = [];
    for (const h of rc.intersectObject(malha, false)) if (!out.length || h.distance - out[out.length - 1] > 1e-4) out.push(h.distance);
    return out;
  };
  return {
    dentro: p => todos(p, dirTeste).length % 2 === 1,
    todos,
    primeiro(o, d) {
      rc.firstHitOnly = true;
      rc.set(o, d);
      const h = rc.intersectObject(malha, false)[0];
      return h ? h.distance : null;
    },
    liberar() { g.disposeBoundsTree(); },
  };
}
