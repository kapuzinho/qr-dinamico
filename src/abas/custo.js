import { volumeDe, areaDe } from '../core/motor.js';
import { numero, escolha, marcar, botao, acoes, saida, secao, tabela, reais } from '../core/ui.js';

const DENSIDADE = { PLA: 1.24, PETG: 1.27, ABS: 1.04, ASA: 1.07, TPU: 1.21, 'PLA-CF': 1.3, 'PETG-CF': 1.3 };

export default {
  id: 'custo', grupo: 'Produção', nome: 'Calcular custo',
  descricao: 'Estima o peso pelo volume da peça e calcula custo e preço de venda com margem e taxa do marketplace.',
  montar(raiz, ctx) {
    const s1 = secao(raiz, 'Impressão');
    this.mat = escolha(s1, 'Material', Object.keys(DENSIDADE).map(k => [k, k]), 'PETG');
    this.inf = numero(s1, 'Preenchimento', 15, { un: '%', passo: 1 });
    this.parede = numero(s1, 'Casca', 1.2, { un: 'mm', dica: 'Paredes, topo e fundo aproximados como uma casca dessa espessura. 3 voltas de 0,4 mm = 1,2 mm.' });
    this.horas = numero(s1, 'Tempo de impressão', 2, { un: 'h', dica: 'Pegue do fatiador. Deixe 0 se não quiser contar máquina e energia.' });
    this.usarFatiamento = marcar(s1, 'Usar peso e tempo do fatiamento real', true, { dica: 'Quando a ferramenta Fatiamento real já rodou pra esta peça, usa o peso e o tempo exatos do Bambu Studio no lugar da estimativa.' });
    const s2 = secao(raiz, 'Custos');
    this.kg = numero(s2, 'Filamento', 100, { un: 'R$/kg', passo: 1 });
    this.hora = numero(s2, 'Máquina e energia', 1.5, { un: 'R$/h' });
    this.emb = numero(s2, 'Embalagem', 2, { un: 'R$' });
    this.frete = numero(s2, 'Frete por sua conta', 0, { un: 'R$' });
    const s3 = secao(raiz, 'Venda');
    this.margem = numero(s3, 'Margem', 100, { un: '%', passo: 5 });
    this.taxa = numero(s3, 'Taxa do marketplace', 16, { un: '%', passo: 0.5, dica: 'Comissão cobrada sobre o preço de venda (Mercado Livre, Shopee etc.).' });
    botao(acoes(raiz), 'Calcular', () => this.calcular(ctx), { primario: true });
    this.out = saida(raiz);
  },
  calcular(ctx) {
    if (!ctx.temPeca()) return;
    ctx.ocupado('Calculando…', () => {
      const m = ctx.manifold(), vol = volumeDe(m), area = areaDe(m);
      const casca = Math.min(vol, area * this.parede());
      const efetivo = casca + (vol - casca) * (this.inf() / 100);
      const fat = this.usarFatiamento() && ctx.fatiamento?.peca === ctx.peca.geom ? ctx.fatiamento : null;
      const peso = fat?.peso ?? (efetivo / 1000) * DENSIDADE[this.mat()];
      const h = fat?.horas ?? this.horas();
      const cMat = (peso / 1000) * this.kg(), cMaq = h * this.hora();
      const custo = cMat + cMaq + this.emb();
      const taxa = this.taxa() / 100;
      const preco = (custo * (1 + this.margem() / 100) + this.frete()) / (1 - taxa);
      const lucro = preco * (1 - taxa) - this.frete() - custo;
      this.out.innerHTML = tabela([
        ['Volume da peça', `${(vol / 1000).toFixed(2).replace('.', ',')} cm³`],
        [fat ? 'Peso (fatiador)' : 'Peso estimado', `${peso.toFixed(1).replace('.', ',')} g`],
        ...(fat ? [['Tempo (fatiador)', `${h.toFixed(2).replace('.', ',')} h`]] : []),
        ['Filamento', reais(cMat)],
        ['Máquina e energia', reais(cMaq)],
        ['Embalagem', reais(this.emb())],
        ['Custo total', reais(custo)],
        ['Preço sugerido', reais(preco), 'ok'],
        ['Lucro por unidade', reais(lucro)],
      ]);
    });
  },
};
