import { assentar } from '../core/motor.js';
import { botao, acoes } from '../core/ui.js';

export function espelhar(g, eixo, mesa) {
  const g2 = g.clone();
  const s = [1, 1, 1];
  s[eixo] = -1;
  g2.scale(...s);
  const idx = g2.index.array; // inverte a ordem dos vértices pra normal continuar pra fora
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g2.index.needsUpdate = true;
  return assentar(g2, mesa);
}

export default {
  id: 'espelhar', grupo: 'Preparar', nome: 'Espelhar',
  descricao: 'Cria a versão espelhada da peça, por exemplo o lado esquerdo a partir do direito.',
  montar(raiz, ctx) {
    const a = acoes(raiz);
    ['X', 'Y', 'Z'].forEach((n, i) => botao(a, `Espelhar em ${n}`, () => {
      if (ctx.temPeca()) ctx.definirPeca(espelhar(ctx.peca.geom, i, ctx.mesa));
    }, { primario: i === 0 }));
  },
};
