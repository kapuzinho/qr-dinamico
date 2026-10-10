import { px, textoCabendo, baixarCanvas, imprimirCanvas } from './_canvas.js';
import { desenharQR } from '../core/formas.js';
import { numero, campoTexto, escolha, cor, botao, acoes, secao, el, aoMudar, texto } from '../core/ui.js';

const PRESETS = {
  'Kapuzinho escuro': ['#1c2b36', '#ffffff', '#b8893a'],
  'Claro verde': ['#ffffff', '#1c2b36', '#0f7c80'],
  'Rosa': ['#f9d9e3', '#5a2340', '#d6457a'],
  'Verde claro': ['#e3f1e7', '#1f4d2e', '#3e7d3a'],
};

export default {
  id: 'tag-chaveiro', grupo: 'Produção', nome: 'Tag chaveiro',
  descricao: 'Tag da marca pra prender nos chaveiros: 3 linhas de texto e QR code, em folha A4 com várias cópias e linha de corte.',
  montar(raiz, ctx) {
    const s1 = secao(raiz, 'Texto');
    this.l1 = campoTexto(s1, 'Linha 1', 'Kapuzinho 3D');
    this.l2 = campoTexto(s1, 'Linha 2', 'Produtos personalizados');
    this.l3 = campoTexto(s1, 'Linha 3', '@k16print');
    this.link = campoTexto(s1, 'Link do QR', 'https://kapuzinho-3d.vercel.app/');
    const s2 = secao(raiz, 'Formato');
    this.larg = numero(s2, 'Largura', 40, { un: 'mm', passo: 1 });
    this.alt = numero(s2, 'Altura (de um lado)', 22, { un: 'mm', passo: 1 });
    this.formato = escolha(s2, 'Tipo', [['simples', 'Simples'], ['dobravel', 'Dobrável (frente e verso)']], 'dobravel',
      { dica: 'Dobrável gera a tag em dobro com linha de dobra no meio, pra dobrar e colar com informação dos dois lados.' });
    this.verso = escolha(s2, 'Metade de baixo', [['girar', 'Girada 180°'], ['espelhar', 'Espelhada']], 'girar',
      { dica: 'Se no teste impresso o verso sair invertido depois de dobrar, troque pra Espelhada.' });
    const s3 = secao(raiz, 'Cores');
    const pre = el('div', { class: 'presets-cor' });
    this.fundo = cor(s3, 'Fundo', '#1c2b36');
    this.corTexto = cor(s3, 'Texto', '#ffffff');
    this.faixa = cor(s3, 'Faixa de destaque', '#b8893a');
    for (const [n, [f, t, d]] of Object.entries(PRESETS)) {
      pre.append(el('button', { type: 'button', class: 'amostra', title: n, style: `background:${f};border-left:8px solid ${d};color:${t}`, text: 'Aa', onclick: () => { this.fundo.definir(f); this.corTexto.definir(t); this.faixa.definir(d); } }));
    }
    s3.prepend(pre);
    s3.prepend(s3.querySelector('legend'));
    const s4 = secao(raiz, 'Folha A4');
    this.qtd = numero(s4, 'Cópias por folha', 24, { passo: 1, min: 1 });
    this.espaco = numero(s4, 'Espaço entre tags', 3, { un: 'mm', passo: 0.5, dica: 'Margem branca entre as unidades pra facilitar o corte.' });
    this.info = texto(s4, '');
    aoMudar([this.l1, this.l2, this.l3, this.link, this.larg, this.alt, this.formato, this.verso, this.fundo, this.corTexto, this.faixa, this.qtd, this.espaco], () => this.previa(ctx));
    const a = acoes(raiz);
    botao(a, 'Gerar folha A4', () => baixarCanvas(this.folha(), 'tags_chaveiro_A4.png'), { primario: true });
    botao(a, 'Gerar 1 unidade de teste', () => baixarCanvas(this.unidade(true), 'tag_chaveiro_teste.png'));
    botao(a, 'Imprimir folha', () => imprimirCanvas(this.folha(), 210, 297));
  },
  ativar(ctx) { document.fonts.ready.then(() => this.previa(ctx)); },
  desativar(ctx) { ctx.previa2D(null); },
  previa(ctx) { ctx.previa2D(this.folha(), this.info.textContent); },
  face(g, x, y, w, h) {
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = this.fundo(); g.fillRect(x, y, w, h);
    const fx = w * 0.06;
    g.fillStyle = this.faixa(); g.fillRect(x, y, fx, h);
    const m = px(2), lado = Math.min(h - 2 * m, w * 0.34);
    let larg = w - fx - 3 * m;
    if (this.link()) {
      const qy = y + (h - lado) / 2;
      g.fillStyle = '#fff'; g.fillRect(x + w - m - lado, qy, lado, lado);
      try { desenharQR(g, this.link(), x + w - m - lado + lado * 0.06, qy + lado * 0.06, lado * 0.88); } catch { /* sem QR */ }
      larg -= lado + m;
    }
    g.fillStyle = this.corTexto();
    g.textBaseline = 'middle';
    const tx = x + fx + m * 1.2;
    textoCabendo(g, this.l1(), tx, y + h * 0.3, larg, Math.round(h * 0.24), 700);
    textoCabendo(g, this.l2(), tx, y + h * 0.58, larg, Math.round(h * 0.13), 500);
    g.fillStyle = this.faixa();
    textoCabendo(g, this.l3(), tx, y + h * 0.8, larg, Math.round(h * 0.13), 600);
    g.restore();
  },
  // desenha uma unidade (com linha de corte e, se dobrável, linha de dobra)
  desenharUnidade(g, x, y) {
    const w = px(this.larg()), h = px(this.alt()), dobra = this.formato() === 'dobravel';
    this.face(g, x, y, w, h);
    if (dobra) {
      g.save();
      if (this.verso() === 'girar') { g.translate(x + w, y + 2 * h); g.rotate(Math.PI); }
      else { g.translate(x, y + 2 * h); g.scale(1, -1); }
      this.face(g, 0, 0, w, h);
      g.restore();
      g.save();
      g.strokeStyle = '#9aa5ab'; g.lineWidth = px(0.25); g.setLineDash([px(0.6), px(0.8)]);
      g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w, y + h); g.stroke();
      g.restore();
    }
    g.save();
    g.strokeStyle = '#000'; g.lineWidth = px(0.2); g.setLineDash([px(1.5), px(1)]);
    g.strokeRect(x, y, w, dobra ? 2 * h : h);
    g.restore();
  },
  unidade(margem = false) {
    const w = px(this.larg()), h = px(this.alt()) * (this.formato() === 'dobravel' ? 2 : 1), m = margem ? px(3) : 0;
    const c = document.createElement('canvas');
    c.width = w + 2 * m; c.height = h + 2 * m;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    this.desenharUnidade(g, m, m);
    return c;
  },
  folha() {
    const A4 = [px(210), px(297)], mg = px(8), esp = px(this.espaco());
    const w = px(this.larg()), h = px(this.alt()) * (this.formato() === 'dobravel' ? 2 : 1);
    const cols = Math.max(1, Math.floor((A4[0] - 2 * mg + esp) / (w + esp))), linhas = Math.max(1, Math.floor((A4[1] - 2 * mg + esp) / (h + esp)));
    const n = Math.min(Math.round(this.qtd()), cols * linhas);
    const c = document.createElement('canvas');
    c.width = A4[0]; c.height = A4[1];
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    const usadasC = Math.min(cols, n), usadasL = Math.ceil(n / cols);
    const x0 = (A4[0] - (usadasC * (w + esp) - esp)) / 2, y0 = (A4[1] - (usadasL * (h + esp) - esp)) / 2;
    for (let i = 0; i < n; i++) this.desenharUnidade(g, x0 + (i % cols) * (w + esp), y0 + Math.floor(i / cols) * (h + esp));
    this.info.textContent = n < this.qtd() ? `Cabem só ${n} nesse tamanho (${cols} × ${linhas}).` : `${n} tags na folha (${cols} colunas × ${Math.ceil(n / cols)} linhas).`;
    return c;
  },
};
