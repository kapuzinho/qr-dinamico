import * as THREE from 'three';
import { M, caixa, paraGeometria, criarTestador, cilindroEixo } from '../core/motor.js';
import { numero, marcar, botao, acoes, saida, secao, tabela } from '../core/ui.js';

export function planos(min, max, lim) {
  const tam = max - min, n = Math.ceil(tam / lim - 1e-6);
  if (n <= 1) return [];
  const passo = tam / n;
  return Array.from({ length: n - 1 }, (_, i) => min + passo * (i + 1));
}

// procura posições no plano de corte com material suficiente dos dois lados pro pino
function acharPinos(peca, eixo, pos, o) {
  const g = paraGeometria(peca), t = criarTestador(g);
  const [u, v] = [0, 1, 2].filter(e => e !== eixo);
  const b = caixa(peca);
  const raioTeste = o.diam / 2 + o.folga + o.parede;
  const passo = Math.max(o.diam * 2.5, Math.min(b.max[u] - b.min[u], b.max[v] - b.min[v]) / 8);
  const deslocs = [-0.4, 0.4, o.comp / 2, o.comp + 0.4 + o.parede / 2];
  const P = new THREE.Vector3(), q = [0, 0, 0], validos = [];
  for (let cu = b.min[u] + raioTeste; cu <= b.max[u] - raioTeste; cu += passo) {
    for (let cv = b.min[v] + raioTeste; cv <= b.max[v] - raioTeste; cv += passo) {
      let ok = true;
      for (const d of deslocs) {
        for (let k = 0; k <= 8 && ok; k++) {
          const r = k === 8 ? 0 : raioTeste, ang = (k * Math.PI) / 4;
          q[eixo] = pos + d; q[u] = cu + Math.cos(ang) * r; q[v] = cv + Math.sin(ang) * r;
          ok = t.dentro(P.set(q[0], q[1], q[2]));
        }
        if (!ok) break;
      }
      if (ok) validos.push([cu, cv]);
    }
  }
  t.liberar();
  g.dispose();
  if (!validos.length) return [];
  const mu = validos.reduce((s, x) => s + x[0], 0) / validos.length;
  const mv = validos.reduce((s, x) => s + x[1], 0) / validos.length;
  validos.sort((a, c) => Math.hypot(a[0] - mu, a[1] - mv) - Math.hypot(c[0] - mu, c[1] - mv));
  const esc = [validos[0]];
  while (esc.length < o.max) {
    let melhor = null, dMelhor = 0;
    for (const c of validos) {
      const d = Math.min(...esc.map(e => Math.hypot(c[0] - e[0], c[1] - e[1])));
      if (d > dMelhor) { dMelhor = d; melhor = c; }
    }
    if (!melhor || dMelhor < o.diam * 3) break;
    esc.push(melhor);
  }
  return esc.map(([cu, cv]) => { const c = [0, 0, 0]; c[u] = cu; c[v] = cv; return c; });
}

export function cortar(peca, eixo, pos, o) {
  const n = [0, 0, 0];
  n[eixo] = 1;
  let mais = peca.trimByPlane(n, pos);
  let menos = peca.trimByPlane([-n[0], -n[1], -n[2]], -pos);
  let pinos = 0;
  if (o.pinos) {
    const centros = acharPinos(peca, eixo, pos, o);
    if (centros.length) {
      const { Manifold } = M();
      // macho preso no lado "menos", entrando no furo fêmea do lado "mais"
      const machos = Manifold.union(centros.map(c => cilindroEixo(eixo, o.diam / 2, pos - 0.5, pos + o.comp, c)));
      const femeas = Manifold.union(centros.map(c => cilindroEixo(eixo, o.diam / 2 + o.folga, pos - 0.01, pos + o.comp + 0.4, c)));
      menos = menos.add(machos);
      mais = mais.subtract(femeas);
      pinos = centros.length;
    }
  }
  return { mais, menos, pinos };
}

export function dividirManifold(m, lim, o) {
  const b = caixa(m);
  let pecas = [m], cortes = 0, pinos = 0;
  for (let eixo = 0; eixo < 3; eixo++) {
    for (const pos of planos(b.min[eixo], b.max[eixo], lim[eixo])) {
      const nova = [];
      for (const p of pecas) {
        const bp = caixa(p);
        if (pos <= bp.min[eixo] + 0.5 || pos >= bp.max[eixo] - 0.5) { nova.push(p); continue; }
        const r = cortar(p, eixo, pos, o);
        cortes++;
        pinos += r.pinos;
        for (const q of [r.menos, r.mais]) if (!q.isEmpty()) nova.push(q);
      }
      pecas = nova;
    }
  }
  return { pecas, cortes, pinos };
}

export default {
  id: 'dividir', grupo: 'Modificar', nome: 'Dividir',
  descricao: 'Corta uma peça maior que a mesa em pedaços que cabem, com pinos macho e fêmea nas faces de corte pra alinhar na colagem.',
  montar(raiz, ctx) {
    const s1 = secao(raiz, 'Tamanho máximo de cada pedaço');
    this.lx = numero(s1, 'X', 240, { un: 'mm', passo: 1, dica: 'Deixe 10 a 15 mm a menos que a mesa pra sobrar espaço pra borda e pra purga.' });
    this.ly = numero(s1, 'Y', 240, { un: 'mm', passo: 1 });
    this.lz = numero(s1, 'Z', 250, { un: 'mm', passo: 1 });
    const s2 = secao(raiz, 'Pinos de encaixe');
    this.pinos = marcar(s2, 'Adicionar pinos', true);
    this.diam = numero(s2, 'Diâmetro do pino', 5, { un: 'mm' });
    this.comp = numero(s2, 'Comprimento saliente', 6, { un: 'mm' });
    this.folga = numero(s2, 'Folga do furo', 0.25, { un: 'mm', passo: 0.05, dica: 'Somada ao raio do furo fêmea. 0,2 a 0,3 mm costuma dar encaixe justo em PETG.' });
    this.parede = numero(s2, 'Parede mínima em volta', 2, { un: 'mm', dica: 'Só coloca pino onde sobra pelo menos essa espessura de material em volta dele.' });
    this.max = numero(s2, 'Máximo de pinos por corte', 4, { passo: 1, min: 1 });
    const a = acoes(raiz);
    botao(a, 'Dividir', () => this.dividir(ctx), { primario: true });
    this.btnBaixar = botao(a, 'Baixar pedaços (.zip)', () => ctx.baixarZip(this.exportar, `${ctx.nomeBase()}_dividido.zip`));
    this.btnBaixar.disabled = true;
    this.out = saida(raiz);
  },
  ativar(ctx) { if (this.resultado && this.fonte === ctx.peca?.geom) this.mostrarResultado(ctx); },
  dividir(ctx) {
    if (!ctx.temPeca()) return;
    ctx.ocupado('Dividindo…', () => {
      const o = { pinos: this.pinos(), diam: this.diam(), comp: this.comp(), folga: this.folga(), parede: this.parede(), max: Math.max(1, Math.round(this.max())) };
      const r = dividirManifold(ctx.manifold(), [this.lx(), this.ly(), this.lz()], o);
      if (r.pecas.length === 1) { this.out.textContent = 'A peça já cabe nesse tamanho, não foi preciso cortar.'; return; }
      this.fonte = ctx.peca.geom;
      this.resultado = r.pecas.map(p => paraGeometria(p));
      this.exportar = this.resultado.map((g, i) => {
        const e = g.clone();
        e.translate(0, 0, -g.boundingBox.min.z);
        return { geom: e, nome: `${ctx.nomeBase()}_parte${String(i + 1).padStart(2, '0')}.stl` };
      });
      r.pecas.forEach(p => p !== ctx.manifold() && p.delete());
      this.btnBaixar.disabled = false;
      this.mostrarResultado(ctx);
      this.out.innerHTML = tabela([['Pedaços', this.resultado.length], ['Cortes', r.cortes], ['Pinos', r.pinos, r.pinos || !o.pinos ? '' : 'aviso']]);
      if (o.pinos && !r.pinos) ctx.log('Nenhum corte tinha espessura pra pino. Diminua o diâmetro ou a parede mínima.', 'erro');
    });
  },
  mostrarResultado(ctx) {
    const c = ctx.peca.geom.boundingBox.getCenter(new THREE.Vector3());
    ctx.viewer.mostrar(this.resultado.map(g => {
      const d = g.boundingBox.getCenter(new THREE.Vector3()).sub(c).multiplyScalar(0.15);
      return { geom: g, deslocar: [d.x, d.y, Math.max(d.z, 0)] };
    }));
  },
};
