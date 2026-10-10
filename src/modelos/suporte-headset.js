import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoHeadset, layoutHeadset, retArred } from './geo.js';
import { deslizante, numero, arquivo, escolha, campoTexto, texto, aoMudar, secao } from '../core/ui.js';
import { M } from '../core/motor.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'suporte-headset', nome: 'Suporte de Headset',
  descricao: 'Suporte de fone/headset: haste com apoio curvo (encaixa na base, imprime deitada e sem suporte) e base com o nome em relevo. Arte opcional ao lado do nome.',
  partes: [
    { id: 'base', nome: 'Base', cor: 0x1f2328 },
    { id: 'haste', nome: 'Haste + apoio', cor: 0x1f2328 },
    { id: 'texto', nome: 'Nome', cor: 0x2fd3a0 },
    { id: 'arte', nome: 'Arte', cor: 0x2fd3a0 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    this.nomeTxt = campoTexto(s, 'Nome na base', 'ALAN GAMER');
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Bangers-Regular.ttf', { aoMudar: mudou });
    arquivo(s, 'Arte ao lado do nome (SVG ou PNG, opcional)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      this.arte = /\.svg$/i.test(f.name) ? { tipo: 'svg', dado: await f.text() } : { tipo: 'img', dado: await lerImagem(f, 800) };
      mudou();
    }, { aoRemover: () => { this.arte = null; mudou(); } });
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Em relevo'], ['rente', 'Rente à base']], 'relevo');
    aoMudar([this.nomeTxt, this.limiar, this.acabamento], mudou);
    texto(s, 'Imprima a base com o nome pra cima e a haste deitada; depois encaixe (uma gota de cola deixa firme).');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sh = secao(raiz, 'Haste e apoio');
    this.alturaHaste = d(sh, 'Altura da haste', 230, { min: 120, max: 320, passo: 1, dica: 'Da base até o topo do apoio. A1: até ~250 deitada.' });
    this.larguraHaste = d(sh, 'Largura da haste', 26, { min: 14, max: 50, passo: 0.5 });
    this.espessura = d(sh, 'Espessura (onde o fone apoia)', 22, { min: 10, max: 40, passo: 0.5 });
    this.raioSela = d(sh, 'Raio do apoio curvo', 45, { min: 20, max: 90, passo: 0.5, dica: 'Curva parecida com a do arco do headset.' });
    this.aberturaSela = deslizante(sh, 'Abertura do apoio', 60, { min: 25, max: 85, passo: 1, un: '°', aoMudar: mudou });
    this.espSela = d(sh, 'Espessura do apoio', 9, { min: 5, max: 20, passo: 0.5 });
    this.labio = d(sh, 'Pontas arredondadas', 1.5, { min: 0, max: 6, passo: 0.5 });
    const sb = secao(raiz, 'Base');
    this.larguraBase = d(sb, 'Largura', 110, { min: 60, max: 200, passo: 1 });
    this.profBase = d(sb, 'Profundidade', 90, { min: 50, max: 160, passo: 1 });
    this.alturaBase = d(sb, 'Altura', 14, { min: 8, max: 30, passo: 0.5 });
    this.raioBase = d(sb, 'Cantos', 10, { min: 0, max: 30, passo: 0.5 });
    this.recuoHaste = d(sb, 'Recuo da haste (de trás)', 12, { min: 4, max: 60, passo: 0.5 });
    this.profEncaixe = d(sb, 'Profundidade do encaixe', 10, { min: 5, max: 25, passo: 0.5 });
    this.folga = d(sb, 'Folga do encaixe', 0.25, { min: 0.05, max: 0.8, passo: 0.05 });
    const st = secao(raiz, 'Nome');
    this.alturaTexto = d(st, 'Altura do nome', 16, { min: 5, max: 50, passo: 0.5 });
    this.tamArte = d(st, 'Tamanho da arte', 26, { min: 5, max: 60, passo: 0.5 });
    this.relevo = d(st, 'Relevo', 1.2, { min: 0.4, max: 4, passo: 0.1 });
    this.margemTexto = d(st, 'Margem', 8, { min: 2, max: 30, passo: 0.5 });
    this.textoY = d(st, 'Ajuste vertical', 0, { min: -30, max: 30, passo: 0.5 });
  },
  async formas() {
    const n = (this.nomeTxt() || '').trim();
    const texto = n ? textoParaSecao(await obterFonte(this.fonte()), n, { altura: 10 }) : null;
    const arte = this.arte ? (this.arte.tipo === 'svg' ? svgParaSecao(this.arte.dado, { largura: 30, ignorarBranco: true }) : imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 30 })) : null;
    return { texto, arte };
  },
  parametros() {
    const k = ['alturaHaste', 'larguraHaste', 'espessura', 'raioSela', 'aberturaSela', 'espSela', 'labio', 'larguraBase', 'profBase', 'alturaBase', 'raioBase',
      'recuoHaste', 'profEncaixe', 'folga', 'alturaTexto', 'tamArte', 'relevo', 'margemTexto', 'textoY'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.acabamento = this.acabamento();
    p.profEncaixe = Math.min(p.profEncaixe, p.alturaBase - 3);
    return p;
  },
  // 2D: vista de cima da base (com o nome) e, ao lado, a haste de frente
  async compor2D(ctx) {
    const p = this.parametros();
    const L = layoutHeadset(await this.formas(), p);
    const C = M().CrossSection;
    const base = retArred(p.larguraBase, p.profBase, p.raioBase);
    const rasgo = C.square([p.larguraHaste + 2 * p.folga, p.espessura + 2 * p.folga], true).translate([0, L.yRasgo]);
    const fb = L.figura.bounds(), escala = Math.min(1, (p.profBase * 1.6) / (fb.max[1] - fb.min[1]));
    const haste = L.figura.scale([escala, escala]).translate([p.larguraBase / 2 + 30, -p.profBase / 2 - fb.min[1] * escala]);
    const partes = [{ id: 'base', poligonos: poligonosDe(base.subtract(rasgo)) }, { id: 'haste', poligonos: poligonosDe(haste) }];
    if (L.texto) partes.push({ id: 'texto', poligonos: poligonosDe(L.texto) });
    if (L.arte) partes.push({ id: 'arte', poligonos: poligonosDe(L.arte) });
    const hb = haste.bounds();
    return {
      largura: (hb.max[0] + p.larguraBase / 2) * 2 + 20, altura: Math.max(p.profBase, hb.max[1] - hb.min[1]) * 1.3 + 20, partes,
      dica: `Esquerda: base vista de cima. Direita: a haste de frente (desenho ${escala < 1 ? 'reduzido' : 'em escala'}). Altura total montado: ${L.alturaTotal.toFixed(0)} mm.`,
    };
  },
  async gerar(ctx) {
    const p = this.parametros();
    const r = geoHeadset(await this.formas(), p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.montado, montado: r.montado.map(([id, m]) => [id, m, [cx, cy, 0]]), imprimir: r.imprimir,
      resumo: `Suporte de headset com ${r.L.alturaTotal.toFixed(0)} mm de altura (apoio de ${r.L.larguraSela.toFixed(0)} mm de largura). `
        + `Base ${p.larguraBase} × ${p.profBase} mm. Os arquivos saem com a base e a haste deitadas, prontas pra imprimir.`,
    };
  },
});
