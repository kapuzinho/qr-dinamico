import { paraGeometria, volumeDe } from '../core/motor.js';
import { ocarPorEscala, ocarPreciso } from '../core/ocar.js';
import { numero, escolha, marcar, botao, acoes, saida, tabela } from '../core/ui.js';

export default {
  id: 'ocar', grupo: 'Modificar', nome: 'Ocar',
  descricao: 'Deixa a peça oca por dentro com parede da espessura escolhida. Use o corte pra conferir a parede antes de baixar.',
  montar(raiz, ctx) {
    this.metodo = escolha(raiz, 'Método', [['preciso', 'Preciso (parede constante)'], ['escala', 'Rápido (por escala)']], 'preciso',
      { dica: 'Preciso mede a distância real até a superfície e mantém a parede igual em todo lugar, até em peça orgânica. Rápido só encolhe a peça por dentro e pode deixar parede torta em formas irregulares.' });
    this.parede = numero(raiz, 'Espessura da parede', 2, { un: 'mm', passo: 0.2, min: 0.4 });
    this.res = escolha(raiz, 'Resolução', [['120', 'Normal'], ['180', 'Alta'], ['240', 'Muito alta (lento)']], '120',
      { dica: 'Só pro método preciso. Mais resolução deixa a parede interna mais lisa e exata, mas demora mais.' });
    this.corte = marcar(raiz, 'Mostrar corte no meio da peça', true, { dica: 'Corta a visualização ao meio (em Y) pra enxergar a parede. Não altera o arquivo.' });
    this.corte.input.addEventListener('change', () => ctx.viewer.definirCorte(this.corte()));
    botao(acoes(raiz), 'Ocar', () => this.ocar(ctx), { primario: true });
    this.out = saida(raiz);
  },
  ativar(ctx) { ctx.viewer.definirCorte(this.corte()); },
  desativar(ctx) { ctx.viewer.definirCorte(false); },
  ocar(ctx) {
    if (!ctx.temPeca()) return;
    ctx.ocupado('Ocando…', () => {
      const m = ctx.manifold(), antes = volumeDe(m);
      let res, voxel = null;
      if (this.metodo() === 'escala') res = ocarPorEscala(m, this.parede());
      else ({ res, voxel } = ocarPreciso(m, ctx.peca.geom, this.parede(), { resolucao: Number(this.res()) }));
      const depois = volumeDe(res);
      ctx.definirPeca(paraGeometria(res));
      res.delete();
      ctx.viewer.definirCorte(this.corte());
      ctx.log('Peça ocada. Confira a parede com o corte ligado.', 'ok');
      this.out.innerHTML = tabela([
        ['Volume antes', `${(antes / 1000).toFixed(1).replace('.', ',')} cm³`],
        ['Volume depois', `${(depois / 1000).toFixed(1).replace('.', ',')} cm³`],
        ['Economia de material', `${((1 - depois / antes) * 100).toFixed(0)}%`, 'ok'],
        ...(voxel ? [['Precisão da grade', `${voxel.toFixed(2).replace('.', ',')} mm`]] : []),
      ]);
    });
  },
};
