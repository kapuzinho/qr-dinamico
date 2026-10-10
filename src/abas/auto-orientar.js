import * as THREE from 'three';
import { dadosFaces } from '../core/motor.js';
import { apoiarNaDirecao } from './nivelar.js';
import { numero, botao, acoes, saida, el } from '../core/ui.js';

function direcoes(k) {
  const out = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]].map(v => new THREE.Vector3(...v));
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < k; i++) {
    const y = 1 - (i / (k - 1)) * 2, r = Math.sqrt(1 - y * y), t = phi * i;
    out.push(new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r));
  }
  return out;
}

// D = direção da peça que vai ficar virada pra mesa
function avaliar(pos, f, D, cosLim) {
  const Ux = -D.x, Uy = -D.y, Uz = -D.z;
  let hmin = Infinity, hmax = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const h = pos[i] * Ux + pos[i + 1] * Uy + pos[i + 2] * Uz;
    if (h < hmin) hmin = h;
    if (h > hmax) hmax = h;
  }
  let balanco = 0, contato = 0;
  for (let i = 0; i < f.n; i++) {
    const a = f.areas[i];
    if (!a) continue;
    const nd = f.normais[i * 3] * D.x + f.normais[i * 3 + 1] * D.y + f.normais[i * 3 + 2] * D.z;
    if (nd <= cosLim) continue;
    const h = f.centros[i * 3] * Ux + f.centros[i * 3 + 1] * Uy + f.centros[i * 3 + 2] * Uz;
    if (h < hmin + 0.2) { if (nd > 0.98) contato += a; } else balanco += a;
  }
  return { D, balanco, contato, altura: hmax - hmin };
}

export default {
  id: 'auto-orientar', grupo: 'Preparar', nome: 'Auto-orientar',
  descricao: 'Testa várias orientações e mostra as que deixam menos área em balanço (que precisaria de suporte).',
  montar(raiz, ctx) {
    this.ang = numero(raiz, 'Ângulo de balanço', 45, { passo: 1, un: '°', dica: 'Faces inclinadas mais que isso em relação à vertical contam como balanço. 45° é o padrão dos fatiadores.' });
    this.qtd = numero(raiz, 'Orientações testadas', 64, { passo: 8, min: 8, dica: 'Mais orientações acham resultados melhores em peças orgânicas, mas demoram mais.' });
    botao(acoes(raiz), 'Analisar', () => this.analisar(ctx), { primario: true });
    this.out = saida(raiz);
  },
  analisar(ctx) {
    if (!ctx.temPeca()) return;
    ctx.ocupado('Testando orientações…', () => {
      const g = ctx.peca.geom, f = dadosFaces(g), pos = g.attributes.position.array;
      const cosLim = Math.cos(THREE.MathUtils.degToRad(90 - this.ang()));
      const tol = f.total * 0.01;
      const res = direcoes(Math.round(this.qtd())).map(D => avaliar(pos, f, D, cosLim));
      res.sort((a, b) => (Math.abs(a.balanco - b.balanco) > tol ? a.balanco - b.balanco : b.contato - a.contato || a.altura - b.altura));
      const atual = avaliar(pos, f, new THREE.Vector3(0, 0, -1), cosLim);
      this.out.innerHTML = '';
      this.out.append(el('p', { text: `Orientação atual: ${atual.balanco.toFixed(0)} mm² em balanço, ${atual.altura.toFixed(1)} mm de altura.` }));
      res.slice(0, 5).forEach((r, i) => {
        const linha = el('div', { class: 'opcao' },
          el('span', { text: `${i + 1}. ${r.balanco.toFixed(0)} mm² em balanço, ${r.contato.toFixed(0)} mm² na mesa, ${r.altura.toFixed(1)} mm de altura` }));
        botao(linha, 'Usar', () => ctx.definirPeca(apoiarNaDirecao(g, r.D, ctx.mesa)));
        this.out.append(linha);
      });
    });
  },
};
