import * as THREE from 'three';
import { dadosFaces, assentar } from '../core/motor.js';
import { botao, acoes, saida } from '../core/ui.js';

// agrupa triângulos coplanares e fica só com os planos que podem encostar na mesa
export function planosDeApoio(g, maximo = 8) {
  const f = dadosFaces(g), p = g.attributes.position.array;
  const grupos = new Map();
  for (let i = 0; i < f.n; i++) {
    const a = f.areas[i];
    if (a < 1e-9) continue;
    const nx = f.normais[i * 3], ny = f.normais[i * 3 + 1], nz = f.normais[i * 3 + 2];
    const d = nx * f.centros[i * 3] + ny * f.centros[i * 3 + 1] + nz * f.centros[i * 3 + 2];
    const k = `${Math.round(nx * 40)},${Math.round(ny * 40)},${Math.round(nz * 40)},${Math.round(d * 4)}`;
    let gr = grupos.get(k);
    if (!gr) grupos.set(k, (gr = { area: 0, nx: 0, ny: 0, nz: 0, d }));
    gr.area += a; gr.nx += nx * a; gr.ny += ny * a; gr.nz += nz * a;
  }
  const ok = [];
  for (const gr of [...grupos.values()].sort((x, y) => y.area - x.area).slice(0, 40)) {
    const n = new THREE.Vector3(gr.nx, gr.ny, gr.nz).normalize();
    let max = -Infinity;
    for (let i = 0; i < p.length; i += 3) { const v = p[i] * n.x + p[i + 1] * n.y + p[i + 2] * n.z; if (v > max) max = v; }
    if (max - gr.d < 0.3) ok.push({ normal: n, area: gr.area });
    if (ok.length >= maximo) break;
  }
  return ok;
}

export function apoiarNaDirecao(g, normal, mesa) {
  const g2 = g.clone();
  g2.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, -1)));
  return assentar(g2, mesa);
}

export default {
  id: 'nivelar', grupo: 'Preparar', nome: 'Nivelar',
  descricao: 'Deita a peça sobre a maior face plana que pode encostar na mesa. Se não for a face que você queria, passe pra próxima.',
  montar(raiz, ctx) {
    const a = acoes(raiz);
    botao(a, 'Nivelar pela maior face', () => this.nivelar(ctx, 0), { primario: true });
    this.btnProx = botao(a, 'Próxima face', () => this.nivelar(ctx, this.i + 1));
    this.btnProx.disabled = true;
    this.out = saida(raiz);
  },
  nivelar(ctx, i) {
    if (!ctx.temPeca()) return;
    ctx.ocupado('Procurando faces planas…', () => {
      if (i === 0) { this.base = ctx.peca.geom; this.cands = planosDeApoio(this.base); }
      if (!this.cands.length) return ctx.log('Nenhuma face plana encontrada.', 'erro');
      this.i = i % this.cands.length;
      const c = this.cands[this.i];
      ctx.definirPeca(apoiarNaDirecao(this.base, c.normal, ctx.mesa), { historico: i === 0 });
      this.btnProx.disabled = this.cands.length < 2;
      this.out.textContent = `Face ${this.i + 1} de ${this.cands.length}: ${c.area.toFixed(0)} mm² encostando na mesa.`;
    });
  },
};
