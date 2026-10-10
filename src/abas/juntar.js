import { M, paraManifold, paraGeometria, combinar, assentar } from '../core/motor.js';
import { lerSTL } from '../core/arquivos.js';
import { escolha, marcar, botao, acoes, saida, el } from '../core/ui.js';

export default {
  id: 'juntar', grupo: 'Modificar', nome: 'Juntar',
  descricao: 'Junta vários STL num arquivo só, fundindo numa peça única ou só agrupando.',
  montar(raiz, ctx) {
    this.arquivos = [];
    const inp = el('input', { type: 'file', accept: '.stl', multiple: '' });
    raiz.append(el('label', { class: 'campo' }, el('span', { class: 'rotulo', text: 'Arquivos' }), inp));
    const lista = saida(raiz);
    inp.addEventListener('change', async () => {
      this.arquivos = [];
      for (const f of inp.files) this.arquivos.push({ nome: f.name, geom: await lerSTL(f) });
      lista.textContent = this.arquivos.map(a => a.nome).join(', ');
    });
    this.incluir = marcar(raiz, 'Incluir a peça aberta', true);
    this.modo = escolha(raiz, 'Como juntar', [['unir', 'Fundir numa peça só'], ['agrupar', 'Só agrupar no mesmo arquivo']], 'unir',
      { dica: 'Fundir remove as partes sobrepostas. Agrupar mantém cada peça separada dentro do mesmo arquivo.' });
    this.pos = escolha(raiz, 'Posição', [['manter', 'Manter a posição original'], ['lado', 'Colocar lado a lado']], 'manter',
      { dica: 'Manter só funciona bem com arquivos exportados juntos (mesma origem) e se a peça aberta não foi girada.' });
    botao(acoes(raiz), 'Juntar', () => this.juntar(ctx), { primario: true });
  },
  juntar(ctx) {
    ctx.ocupado('Juntando…', () => {
      const d = ctx.deslocamentoCarga || [0, 0, 0];
      let geoms = this.arquivos.map(a => {
        const g = a.geom.clone();
        if (this.pos() === 'manter') g.translate(...d);
        return g;
      });
      if (this.incluir() && ctx.peca) geoms.unshift(ctx.peca.geom.clone());
      if (geoms.length < 2) return ctx.log('Escolha pelo menos dois arquivos pra juntar.', 'erro');
      if (this.pos() === 'lado') {
        let x = 0;
        for (const g of geoms) {
          g.computeBoundingBox();
          const b = g.boundingBox;
          g.translate(x - b.min.x, -(b.min.y + b.max.y) / 2, -b.min.z);
          x += b.max.x - b.min.x + 5;
        }
      }
      const ms = geoms.map(paraManifold);
      const res = this.modo() === 'unir' ? M().Manifold.union(ms) : combinar(ms);
      let g = paraGeometria(res);
      if (this.pos() === 'lado') g = assentar(g, ctx.mesa);
      ms.forEach(m => m.delete());
      res.delete();
      ctx.definirPeca(g, { enquadrar: true });
      ctx.log(`${geoms.length} peças juntadas.`, 'ok');
    });
  },
};
