import { px, quebrarTexto, textoCabendo, baixarCanvas, imprimirCanvas } from './_canvas.js';
import { desenharQR } from '../core/formas.js';
import { numero, campoTexto, areaTexto, escolha, marcar, botao, acoes, secao, aoMudar } from '../core/ui.js';

const CUIDADOS = {
  PLA: 'Não deixar no sol nem dentro do carro. Evitar água quente (acima de 50 °C). Limpar com pano úmido.',
  PETG: 'Resiste a água e ao uso diário. Evitar calor acima de 70 °C. Pode lavar com água e sabão neutro.',
  ABS: 'Resiste ao calor. Limpar com pano úmido. Evitar solventes como acetona.',
  ASA: 'Resiste ao sol e ao calor, bom pra uso externo. Limpar com pano úmido.',
  TPU: 'Material flexível. Lavar com água e sabão neutro. Evitar calor excessivo.',
};

export default {
  id: 'etiqueta', grupo: 'Produção', nome: 'Etiqueta',
  descricao: 'Etiqueta de embalagem em PNG 300 DPI no tamanho exato em milímetros, com nome, SKU, peso, material, cuidados e QR code opcional.',
  montar(raiz, ctx) {
    const s1 = secao(raiz, 'Tamanho');
    this.larg = numero(s1, 'Largura', 70, { un: 'mm', passo: 1 });
    this.alt = numero(s1, 'Altura', 40, { un: 'mm', passo: 1 });
    this.borda = marcar(s1, 'Borda fina em volta', true);
    const s2 = secao(raiz, 'Conteúdo');
    this.produto = campoTexto(s2, 'Produto', 'Suporte giratório de temperos');
    this.sku = campoTexto(s2, 'SKU', 'K3D-001');
    this.peso = campoTexto(s2, 'Peso', '120 g');
    this.material = escolha(s2, 'Material', Object.keys(CUIDADOS).map(k => [k, k]), 'PETG');
    this.cuidados = areaTexto(s2, 'Cuidados', CUIDADOS.PETG, { linhas: 3, dica: 'Muda sozinho ao trocar o material, e dá pra editar à vontade.' });
    this.material.input.addEventListener('change', () => this.cuidados.definir(CUIDADOS[this.material()]));
    this.qr = marcar(s2, 'QR code', true);
    this.link = campoTexto(s2, 'Link do QR', 'https://kapuzinho-3d.vercel.app/', { dica: 'Link do anúncio ou da sua loja.' });
    aoMudar([this.larg, this.alt, this.borda, this.produto, this.sku, this.peso, this.material, this.cuidados, this.qr, this.link], () => this.desenhar(ctx));
    const a = acoes(raiz);
    botao(a, 'Baixar PNG', () => baixarCanvas(this.desenhar(ctx), `etiqueta_${this.sku() || 'produto'}.png`), { primario: true });
    botao(a, 'Imprimir', () => imprimirCanvas(this.desenhar(ctx), this.larg(), this.alt()));
  },
  ativar(ctx) { document.fonts.ready.then(() => this.desenhar(ctx)); },
  desativar(ctx) { ctx.previa2D(null); },
  desenhar(ctx) {
    const W = px(this.larg()), H = px(this.alt()), m = px(3);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    if (this.borda()) { g.strokeStyle = '#1c2b36'; g.lineWidth = px(0.3); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth); }
    let larguraTexto = W - 2 * m;
    if (this.qr() && this.link()) {
      const lado = Math.min(H - 2 * m, W * 0.38);
      try { desenharQR(g, this.link(), W - m - lado, (H - lado) / 2, lado); larguraTexto -= lado + m; } catch { /* link vazio */ }
    }
    g.fillStyle = '#1c2b36';
    g.textBaseline = 'top';
    let y = m;
    const tNome = textoCabendo(g, this.produto(), m, y, larguraTexto, px(4.2), 700);
    y += tNome * 1.25;
    const info = [`SKU: ${this.sku()}`, `Peso: ${this.peso()}`, `Material: ${this.material()}`].filter(l => !/: $/.test(l));
    g.font = `500 ${px(2.6)}px Barlow, Arial, sans-serif`;
    for (const l of info) { g.fillText(l, m, y); y += px(2.6) * 1.3; }
    y += px(0.8);
    g.font = `400 ${px(2.1)}px Barlow, Arial, sans-serif`;
    g.fillStyle = '#56666f';
    for (const l of quebrarTexto(g, this.cuidados(), larguraTexto)) { if (y + px(2.1) > H - m) break; g.fillText(l, m, y); y += px(2.1) * 1.3; }
    ctx.previa2D(c, `${this.larg()} × ${this.alt()} mm a 300 DPI`);
    return c;
  },
};
