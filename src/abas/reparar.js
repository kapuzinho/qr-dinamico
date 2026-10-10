import * as THREE from 'three';
import { contarBordas, paraManifold, paraGeometria, geometriaCompacta } from '../core/motor.js';
import { prepararGeometria } from '../core/arquivos.js';
import { numero, botao, acoes, saida, tabela } from '../core/ui.js';

export function limparMalha(geom, tol) {
  const g = prepararGeometria(geom.index ? geom.toNonIndexed() : geom.clone(), tol);
  const p = g.attributes.position.array, idx = g.index.array;
  const vistos = new Set(), novo = [];
  let degeneradas = 0, duplicadas = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    if (a === b || b === c || a === c) { degeneradas++; continue; }
    A.fromArray(p, a * 3); B.fromArray(p, b * 3); C.fromArray(p, c * 3);
    if (B.sub(A).cross(C.sub(A)).lengthSq() < 1e-12) { degeneradas++; continue; }
    const chave = [a, b, c].sort((x, y) => x - y).join(',');
    if (vistos.has(chave)) { duplicadas++; continue; }
    vistos.add(chave);
    novo.push(a, b, c);
  }
  return { geom: geometriaCompacta(p, novo), degeneradas, duplicadas };
}

export default {
  id: 'reparar', grupo: 'Conferir', nome: 'Reparar',
  descricao: 'Solda vértices duplicados, remove triângulos degenerados ou repetidos e tenta fechar a malha pra ela funcionar nas outras ferramentas.',
  montar(raiz, ctx) {
    this.tol = numero(raiz, 'Distância de solda', 0.001, { passo: 0.001, un: 'mm', dica: 'Vértices mais próximos que isso viram um só. Se sobrar borda aberta, tente 0,01 ou 0,05.' });
    botao(acoes(raiz), 'Reparar', () => this.reparar(ctx), { primario: true });
    this.out = saida(raiz);
  },
  reparar(ctx) {
    if (!ctx.temPeca()) return;
    ctx.ocupado('Reparando malha…', () => {
      const antes = contarBordas(ctx.peca.geom);
      const r = limparMalha(ctx.peca.geom, this.tol());
      let final = r.geom, fechada = false;
      try {
        const m = paraManifold(r.geom);
        if (!m.isEmpty()) { final = paraGeometria(m); fechada = true; }
        m.delete();
      } catch { /* continua aberta */ }
      const depois = contarBordas(final);
      ctx.definirPeca(final);
      this.out.innerHTML = tabela([
        ['Bordas abertas', `${antes.abertas} → ${depois.abertas}`],
        ['Arestas com 3+ faces', `${antes.naoManifold} → ${depois.naoManifold}`],
        ['Triângulos degenerados removidos', r.degeneradas],
        ['Triângulos repetidos removidos', r.duplicadas],
        ['Resultado', fechada ? 'Malha fechada e válida' : 'Ainda aberta: aumente a distância de solda', fechada ? 'ok' : 'aviso'],
      ]);
    });
  },
};
