import { assentar } from '../core/motor.js';
import { numero, escolha, marcar, botao, acoes, saida } from '../core/ui.js';

export default {
  id: 'escalar', grupo: 'Preparar', nome: 'Escalar',
  descricao: 'Redimensiona a peça por igual nos três eixos: pra caber na mesa, por porcentagem ou pela medida de um eixo.',
  montar(raiz, ctx) {
    this.modo = escolha(raiz, 'Modo', [['mesa', 'Caber na mesa'], ['pct', 'Porcentagem'], ['eixo', 'Medida de um eixo']], 'mesa');
    this.margem = numero(raiz, 'Margem da mesa', 5, { un: 'mm', passo: 1 });
    this.naoAumentar = marcar(raiz, 'Não aumentar se já couber', true);
    this.pct = numero(raiz, 'Porcentagem', 100, { un: '%', passo: 1 });
    this.eixo = escolha(raiz, 'Eixo', [['x', 'X'], ['y', 'Y'], ['z', 'Z']], 'z');
    this.medida = numero(raiz, 'Medida desejada', 100, { un: 'mm', passo: 0.5 });
    botao(acoes(raiz), 'Escalar', () => this.aplicar(ctx), { primario: true });
    this.out = saida(raiz);
  },
  aplicar(ctx) {
    if (!ctx.temPeca()) return;
    const g = ctx.peca.geom.clone();
    g.computeBoundingBox();
    const s = { x: g.boundingBox.max.x - g.boundingBox.min.x, y: g.boundingBox.max.y - g.boundingBox.min.y, z: g.boundingBox.max.z - g.boundingBox.min.z };
    let f = 1;
    if (this.modo() === 'mesa') {
      const m = this.margem();
      f = Math.min((ctx.mesa.x - 2 * m) / s.x, (ctx.mesa.y - 2 * m) / s.y, (ctx.mesa.z - m) / s.z);
      if (this.naoAumentar() && f >= 1) return ctx.log('A peça já cabe na mesa.', 'ok');
    } else if (this.modo() === 'pct') f = this.pct() / 100;
    else f = this.medida() / s[this.eixo()];
    if (!(f > 0)) return ctx.log('Valor de escala inválido.', 'erro');
    g.scale(f, f, f);
    ctx.definirPeca(assentar(g, ctx.mesa), { enquadrar: true });
    this.out.textContent = `Escala aplicada: ${(f * 100).toFixed(2).replace('.', ',')}%. Novo tamanho: ${(s.x * f).toFixed(1)} × ${(s.y * f).toFixed(1)} × ${(s.z * f).toFixed(1)} mm.`;
  },
};
