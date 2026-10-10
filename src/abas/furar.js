import { furar, paraGeometria, DIR_DA_VISTA, VETOR, OPCOES_VISTA } from '../core/motor.js';
import { numero, escolha, botao, acoes } from '../core/ui.js';

export default {
  id: 'furar', grupo: 'Modificar', nome: 'Furar',
  descricao: 'Faz um furo redondo na direção da vista escolhida. Clique e arraste sobre a peça pra posicionar o círculo vermelho.',
  montar(raiz, ctx) {
    this.vista = escolha(raiz, 'Vista', OPCOES_VISTA, 'cima', { dica: 'O furo entra na peça na direção em que você está olhando.' });
    this.diam = numero(raiz, 'Diâmetro', 5, { un: 'mm', passo: 0.1, min: 0.2 });
    this.tipo = escolha(raiz, 'Tipo', [['passante', 'Atravessa a peça'], ['cego', 'Profundidade fixa']], 'passante');
    this.prof = numero(raiz, 'Profundidade', 10, { un: 'mm', dica: 'Só vale pra "Profundidade fixa". Medida a partir do ponto clicado na superfície.' });
    this.vista.input.addEventListener('change', () => this.ativar(ctx));
    this.diam.input.addEventListener('input', () => this.ativar(ctx, false));
    botao(acoes(raiz), 'Furar aqui', () => this.aplicar(ctx), { primario: true });
  },
  ativar(ctx, mudarCamera = true) {
    if (mudarCamera) ctx.viewer.vista(this.vista());
    ctx.viewer.ativarSelecao({ raio: this.diam() / 2, dir: VETOR[DIR_DA_VISTA[this.vista()]] });
  },
  desativar(ctx) { ctx.viewer.desativarSelecao(); },
  aplicar(ctx) {
    if (!ctx.temPeca()) return;
    const p = ctx.viewer.ponto;
    if (!p) return ctx.log('Clique na peça pra marcar onde furar.', 'erro');
    ctx.ocupado('Furando…', () => {
      const res = furar(ctx.manifold(), p, DIR_DA_VISTA[this.vista()], this.diam() / 2, { passante: this.tipo() === 'passante', prof: this.prof() });
      ctx.definirPeca(paraGeometria(res));
      res.delete();
      ctx.viewer.limparPonto();
      ctx.log('Furo aplicado. Use Desfazer se não ficou bom.', 'ok');
    });
  },
};
