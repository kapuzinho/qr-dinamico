// Ocar peças: por escala (rápido) ou preciso por campo de distância (parede constante)
import { M, caixa, criarTestador } from './motor.js';
import * as THREE from 'three';

export function ocarPorEscala(man, parede) {
  const b = caixa(man);
  const c = [0, 1, 2].map(i => (b.min[i] + b.max[i]) / 2);
  const f = [0, 1, 2].map(i => { const L = b.max[i] - b.min[i]; return Math.max(0.01, (L - 2 * parede) / L); });
  const dentro = man.translate(c.map(v => -v)).scale(f).translate(c);
  const res = man.subtract(dentro);
  dentro.delete();
  return res;
}

const INF = 1e20;
function dt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
}

// distância (em voxels, ao quadrado) até o voxel de fora mais próximo
function transformadaDistancia(grade, nx, ny, nz) {
  const n = Math.max(nx, ny, nz);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const passar = (len, idx) => {
    for (let i = 0; i < len; i++) f[i] = grade[idx(i)];
    dt1d(f, len, d, v, z);
    for (let i = 0; i < len; i++) grade[idx(i)] = d[i];
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) passar(nx, i => i + nx * (j + ny * k));
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) passar(ny, j => i + nx * (j + ny * k));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) passar(nz, k => i + nx * (j + ny * k));
}

export function ocarPreciso(man, geom, parede, { resolucao = 160 } = {}) {
  const b = caixa(man);
  const tam = [0, 1, 2].map(i => b.max[i] - b.min[i]);
  const h = Math.max(parede / 2.5, Math.max(...tam) / resolucao, 0.15);
  const o = [0, 1, 2].map(i => b.min[i] - 1.5 * h);
  const [nx, ny, nz] = tam.map(t => Math.ceil(t / h) + 4);
  const grade = new Float32Array(nx * ny * nz);
  const t = criarTestador(geom);
  const P = new THREE.Vector3(), cimaZ = new THREE.Vector3(0, 0, 1);
  const z0 = o[2] - 1;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      P.set(o[0] + i * h + 1.37e-4, o[1] + j * h + 2.11e-4, z0);
      const hits = t.todos(P, cimaZ);
      let p = 0;
      for (let k = 0; k < nz; k++) {
        const zk = o[2] + k * h - z0;
        while (p < hits.length && hits[p] < zk) p++;
        grade[i + nx * (j + ny * k)] = p % 2 === 1 ? INF : 0;
      }
    }
  }
  t.liberar();
  transformadaDistancia(grade, nx, ny, nz);
  const amostra = (x, y, zz) => {
    const gx = Math.min(Math.max((x - o[0]) / h, 0), nx - 1.001), gy = Math.min(Math.max((y - o[1]) / h, 0), ny - 1.001), gz = Math.min(Math.max((zz - o[2]) / h, 0), nz - 1.001);
    const i = Math.floor(gx), j = Math.floor(gy), k = Math.floor(gz), fx = gx - i, fy = gy - j, fz = gz - k;
    const at = (a, bb, c) => Math.sqrt(grade[a + nx * (bb + ny * c)]);
    const c00 = at(i, j, k) * (1 - fx) + at(i + 1, j, k) * fx, c10 = at(i, j + 1, k) * (1 - fx) + at(i + 1, j + 1, k) * fx;
    const c01 = at(i, j, k + 1) * (1 - fx) + at(i + 1, j, k + 1) * fx, c11 = at(i, j + 1, k + 1) * (1 - fx) + at(i + 1, j + 1, k + 1) * fx;
    return ((c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz) * h - h / 2;
  };
  if (tam.some(t => t <= 2 * parede + h)) throw new Error('A parede é grossa demais pra essa peça.');
  const sdf = p => amostra(p[0], p[1], p[2]) - parede;
  let cavidade = null;
  for (const f of [1, 0.93, 1.07]) { // o levelSet do manifold às vezes falha em certas combinações de grade; tenta de novo
    const e = h * f;
    try { cavidade = M().Manifold.levelSet(sdf, { min: b.min.map(v => v - e), max: b.max.map(v => v + e) }, e, 0); break; } catch { cavidade = null; }
  }
  if (!cavidade) throw new Error('Não foi possível calcular a parede. Tente outra resolução.');
  if (cavidade.isEmpty()) throw new Error('Não sobrou espaço interno com essa espessura de parede.');
  const res = man.subtract(cavidade);
  cavidade.delete();
  return { res, voxel: h };
}
