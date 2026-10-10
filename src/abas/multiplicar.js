import { caixa, paraGeometria, combinar } from '../core/motor.js';
import { numero, marcar, botao, acoes, saida, tabela } from '../core/ui.js';

export function montarPlacas(m, qtd, esp, margem, mesa, testarGiro = true) {
  const W = mesa.x - 2 * margem, H = mesa.y - 2 * margem;
  const b = caixa(m), w = b.max[0] - b.min[0], h = b.max[1] - b.min[1];
  const cabe = (pw, ph) => {
    const c = Math.max(0, Math.floor((W + esp) / (pw + esp))), r = Math.max(0, Math.floor((H + esp) / (ph + esp)));
    return { c, r, n: c * r, pw, ph };
  };
  const normal = cabe(w, h), girada = testarGiro ? cabe(h, w) : { n: 0 };
  const girar = girada.n > normal.n, g = girar ? girada : normal;
  if (!g.n) return null;
  let base = girar ? m.rotate([0, 0, 90]) : m;
  const bb = caixa(base);
  base = base.translate([-bb.min[0], -bb.min[1], -bb.min[2]]);
  const placas = [];
  for (let pl = 0; pl < Math.ceil(qtd / g.n); pl++) {
    const n = Math.min(g.n, qtd - pl * g.n), cols = Math.min(g.c, n), linhas = Math.ceil(n / g.c);
    const x0 = (mesa.x - (cols * (g.pw + esp) - esp)) / 2, y0 = (mesa.y - (linhas * (g.ph + esp) - esp)) / 2;
    const copias = [];
    for (let i = 0; i < n; i++) copias.push(base.translate([x0 + (i % g.c) * (g.pw + esp), y0 + Math.floor(i / g.c) * (g.ph + esp), 0]));
    const placa = combinar(copias);
    placas.push({ geom: paraGeometria(placa), n });
    copias.forEach(c => c.delete());
    placa.delete();
  }
  base.delete();
  return { placas, porPlaca: g.n, girar };
}

export default {
  id: 'multiplicar', grupo: 'Produção', nome: 'Multiplicar',
  descricao: 'Gera várias cópias da peça arrumadas em grade na mesa. Se não couber tudo, divide em mais de uma placa.',
  montar(raiz, ctx) {
    this.qtd = numero(raiz, 'Quantidade', 20, { passo: 1, min: 1 });
    this.esp = numero(raiz, 'Espaço entre cópias', 4, { un: 'mm', passo: 0.5 });
    this.margem = numero(raiz, 'Margem da mesa', 8, { un: 'mm', passo: 1 });
    this.girar = marcar(raiz, 'Testar peça girada 90°', true, { dica: 'Usa a orientação que cabe mais cópias por placa.' });
    const a = acoes(raiz);
    botao(a, 'Gerar placas', () => this.gerar(ctx), { primario: true });
    this.btnAnt = botao(a, 'Placa anterior', () => this.ver(ctx, this.i - 1));
    this.btnProx = botao(a, 'Próxima placa', () => this.ver(ctx, this.i + 1));
    this.btnBaixar = botao(a, 'Baixar placas (.zip)', () => ctx.baixarZip(this.placas, `${ctx.nomeBase()}_placas.zip`));
    [this.btnAnt, this.btnProx, this.btnBaixar].forEach(b => (b.disabled = true));
    this.out = saida(raiz);
  },
  ativar(ctx) { if (this.placas && this.fonte === ctx.peca?.geom) this.ver(ctx, this.i); },
  gerar(ctx) {
    if (!ctx.temPeca()) return;
    ctx.ocupado('Montando placas…', () => {
      const qtd = Math.max(1, Math.round(this.qtd()));
      const r = montarPlacas(ctx.manifold(), qtd, this.esp(), this.margem(), ctx.mesa, this.girar());
      if (!r) return ctx.log('A peça não cabe na mesa nem girada. Use Dividir ou Escalar.', 'erro');
      this.fonte = ctx.peca.geom;
      this.placas = r.placas.map((p, i) => ({ geom: p.geom, nome: `${ctx.nomeBase()}_placa${i + 1}_${p.n}un.stl` }));
      this.btnBaixar.disabled = false;
      this.out.innerHTML = tabela([['Cópias por placa', r.porPlaca], ['Placas', this.placas.length], ['Peça girada 90°', r.girar ? 'Sim' : 'Não']]);
      this.ver(ctx, 0);
    });
  },
  ver(ctx, i) {
    this.i = Math.max(0, Math.min(i, this.placas.length - 1));
    ctx.viewer.mostrar([{ geom: this.placas[this.i].geom }]);
    this.btnAnt.disabled = this.i === 0;
    this.btnProx.disabled = this.i >= this.placas.length - 1;
    ctx.log(`Mostrando placa ${this.i + 1} de ${this.placas.length}.`);
  },
};
