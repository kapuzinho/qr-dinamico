import * as THREE from 'three';
import { furar, paraGeometria, criarTestador, volumeDe, DIR_DA_VISTA, VETOR, OPCOES_VISTA } from '../core/motor.js';
import { numero, escolha, botao, acoes, saida, tabela, mm } from '../core/ui.js';

// espessura de material em volta do furo, medida em 16 direções ao longo do furo
export function medirParede(geom, ponto, dirNome, r) {
  const t = criarTestador(geom);
  const D = new THREE.Vector3(...VETOR[dirNome]);
  const aux = Math.abs(D.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const U = new THREE.Vector3().crossVectors(D, aux).normalize();
  const W = new THREE.Vector3().crossVectors(D, U);
  geom.computeBoundingBox();
  const diag = geom.boundingBox.getSize(new THREE.Vector3()).length();
  const E = new THREE.Vector3(), P = new THREE.Vector3(), R = new THREE.Vector3();
  let minimo = Infinity;
  for (let s = -diag; s < diag; s += 0.6) {
    E.copy(ponto).addScaledVector(D, s);
    if (!t.dentro(P.copy(E).addScaledVector(U, r + 0.2))) continue;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      R.copy(U).multiplyScalar(Math.cos(a)).addScaledVector(W, Math.sin(a));
      const h = t.todos(E, R);
      if (h.length >= 2) minimo = Math.min(minimo, h[1] - h[0]);
    }
  }
  t.liberar();
  return minimo;
}

export default {
  id: 'chaveiro', grupo: 'Modificar', nome: 'Chaveiro',
  descricao: 'Fura a peça no ponto clicado pra passar argola de chaveiro e confere se sobrou parede suficiente em volta.',
  montar(raiz, ctx) {
    this.vista = escolha(raiz, 'Vista', OPCOES_VISTA, 'cima');
    this.diam = numero(raiz, 'Diâmetro do furo', 4.5, { un: 'mm', dica: '4,5 mm passa a argola padrão de chaveiro com folga.' });
    this.parede = numero(raiz, 'Parede mínima em volta', 1.5, { un: 'mm', dica: 'Abaixo disso a argola tende a arrebentar a borda com o uso.' });
    this.vista.input.addEventListener('change', () => this.ativar(ctx));
    this.diam.input.addEventListener('input', () => this.ativar(ctx, false));
    botao(acoes(raiz), 'Furar pro chaveiro', () => this.aplicar(ctx), { primario: true });
    this.out = saida(raiz);
  },
  ativar(ctx, mudarCamera = true) {
    if (mudarCamera) ctx.viewer.vista(this.vista());
    ctx.viewer.ativarSelecao({ raio: this.diam() / 2 + this.parede(), dir: VETOR[DIR_DA_VISTA[this.vista()]] });
  },
  desativar(ctx) { ctx.viewer.desativarSelecao(); },
  aplicar(ctx) {
    if (!ctx.temPeca()) return;
    const p = ctx.viewer.ponto?.clone();
    if (!p) return ctx.log('Clique na peça pra marcar onde vai o furo.', 'erro');
    ctx.ocupado('Furando e conferindo…', () => {
      const dir = DIR_DA_VISTA[this.vista()], r = this.diam() / 2;
      const res = furar(ctx.manifold(), p, dir, r);
      const partes = res.decompose();
      const antes = ctx.manifold().decompose();
      const conta = l => l.filter(x => volumeDe(x) > 0).length;
      const quebrou = conta(partes) > conta(antes);
      partes.forEach(x => x.delete()); antes.forEach(x => x.delete());
      const g = paraGeometria(res);
      res.delete();
      const parede = medirParede(g, p, dir, r);
      ctx.definirPeca(g);
      ctx.viewer.limparPonto();
      const fina = parede < this.parede();
      this.out.innerHTML = tabela([
        ['Parede mais fina em volta', Number.isFinite(parede) ? mm(parede, 2) : '—', fina ? 'aviso' : 'ok'],
        ['Peça continua inteira', quebrou ? 'Não, o furo separou a peça' : 'Sim', quebrou ? 'aviso' : 'ok'],
      ]);
      if (quebrou || fina) ctx.log('Furo perto demais da borda. Desfaça e clique mais pra dentro.', 'erro');
      else ctx.log('Furo de chaveiro aplicado.', 'ok');
    });
  },
};
