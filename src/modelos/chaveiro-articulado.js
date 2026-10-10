import { criarEditorModelo } from './editor.js';
import { comandosParaPoligonos } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoChaveiroArticulado, layoutChaveiroArticulado, juntaArticulada } from './geo.js';
import { deslizante, escolha, marcar, campoTexto, texto, aoMudar, secao } from '../core/ui.js';
import { M } from '../core/motor.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

// cada letra vira uma forma separada, todas na mesma escala e na mesma linha de base
function glifosDoTexto(font, txt, alturaMaiuscula) {
  const tam = 100;
  const CS = M().CrossSection;
  const ref = font.charToGlyph('H').getPath(0, 0, tam).getBoundingBox();
  const capH = (ref.y2 - ref.y1) || tam * 0.7;
  const s = alturaMaiuscula / capH;
  return [...txt].map(ch => {
    if (/\s/.test(ch)) return null;
    const polys = comandosParaPoligonos(font.charToGlyph(ch).getPath(0, 0, tam).commands);
    if (!polys.length) return null;
    return new CS(polys, 'NonZero').scale([s, s]).simplify(0.01);
  });
}

export default criarEditorModelo({
  id: 'chaveiro-articulado', nome: 'Chaveiro Articulado (letras que balançam)',
  descricao: 'Chaveiro de nome articulado: cada letra é um bloco ligado à próxima por uma dobradiça (pino horizontal) impressa no lugar. Sai da mesa já montado e as letras balançam.',
  partes: [
    { id: 'base', nome: 'Blocos + juntas', cor: 0x9c86e0 },
    { id: 'letras', nome: 'Letras', cor: 0xffb3cc },
  ],
  montarConteudo(s, ctx, mudou) {
    this.nomeTxt = campoTexto(s, 'Nome', 'SEU NOME');
    this.maiusculas = marcar(s, 'Tudo em maiúsculas', true);
    this.maiusculas.input.addEventListener('change', mudou);
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Black.ttf', { aoMudar: mudou, dica: 'Fontes bem grossas ficam melhores (Poppins Black, Bangers, Alfa Slab).' });
    this.ladoArgola = escolha(s, 'Argola', [['esquerda', 'Na primeira letra'], ['nenhuma', 'Sem argola']], 'esquerda');
    aoMudar([this.nomeTxt, this.ladoArgola], mudou);
    texto(s, 'Imprima sem suporte, do jeito que sai. Depois de tirar da mesa, mexa cada letra pra soltar as juntas.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sl = secao(raiz, 'Letras');
    this.alturaTexto = d(sl, 'Altura das letras', 18, { min: 8, max: 50, passo: 0.5, dica: 'Altura de uma letra maiúscula.' });
    this.engrossar = d(sl, 'Engrossar letras', 0, { min: 0, max: 1.5, passo: 0.05 });
    this.relevo = d(sl, 'Altura das letras (relevo)', 3, { min: 0.6, max: 10, passo: 0.2 });
    this.borda = d(sl, 'Borda do bloco', 2.5, { min: 1, max: 6, passo: 0.1 });
    this.fecho = d(sl, 'Suavizar contorno', 1, { min: 0, max: 8, passo: 0.5 });
    this.espaco = d(sl, 'Espaço entre letras', 1, { min: 0.6, max: 15, passo: 0.2, dica: 'Mínimo. Aumenta sozinho se a junta precisar de mais espaço.' });
    this.larguraEspaco = d(sl, 'Largura do espaço', 6, { min: 0, max: 30, passo: 0.5, dica: 'Distância extra onde o nome tem espaço.' });

    const sj = secao(raiz, 'Dobradiças (impressas no lugar)');
    this.pino = d(sj, 'Diâmetro do pino', 3.2, { min: 2, max: 6, passo: 0.1 });
    this.folgaRadial = d(sj, 'Folga do pino', 0.35, { min: 0.15, max: 0.8, passo: 0.05, dica: 'Folga em volta do pino e dos cilindros. Se grudar, aumente (PETG: 0.35–0.45).' });
    this.folgaAxial = d(sj, 'Folga lateral', 0.4, { min: 0.2, max: 1, passo: 0.05, dica: 'Vão entre a língua do meio e os garfos.' });
    this.paredeJunta = d(sj, 'Parede da dobradiça', 1.4, { min: 0.8, max: 3, passo: 0.1, dica: 'Define a grossura dos cilindros (e a altura do bloco).' });
    this.larguraJunta = d(sj, 'Largura da dobradiça', 14, { min: 6, max: 40, passo: 0.5, dica: 'Comprimento ao longo do eixo (no máximo, a altura do bloco).' });
    this.fracaoLingua = deslizante(sj, 'Tamanho da língua do meio', 0.4, { min: 0.2, max: 0.6, passo: 0.05, aoMudar: mudou });
    this.juntaY = d(sj, 'Posição da dobradiça', 0, { min: -20, max: 20, passo: 0.5, dica: '0 = no meio do bloco.' });

    const sg = secao(raiz, 'Argola do chaveiro');
    this.furo = d(sg, 'Diâmetro do furo', 4, { min: 2, max: 10, passo: 0.25 });
    this.paredeArgola = d(sg, 'Parede da argola', 2.5, { min: 1.2, max: 5, passo: 0.1 });
    this.sobreposicao = d(sg, 'Encaixe no bloco', 3, { min: 0, max: 8, passo: 0.25 });
    this.argolaY = d(sg, 'Ajuste vertical', 0, { min: -20, max: 20, passo: 0.5 });
  },
  async glifos() {
    let nome = (this.nomeTxt() || '').trim();
    if (!nome) throw new Error('Digite o nome.');
    if (this.maiusculas()) nome = nome.toUpperCase();
    return glifosDoTexto(await obterFonte(this.fonte()), nome, this.alturaTexto());
  },
  parametros() {
    const k = ['alturaTexto', 'engrossar', 'relevo', 'borda', 'fecho', 'espaco', 'larguraEspaco', 'pino', 'folgaRadial', 'folgaAxial',
      'paredeJunta', 'larguraJunta', 'fracaoLingua', 'juntaY', 'furo', 'paredeArgola', 'sobreposicao', 'argolaY'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    if (this.ladoArgola() === 'nenhuma') p.semArgola = true;
    return p;
  },
  async compor2D(ctx) {
    const gl = await this.glifos();
    const p = this.parametros();
    const L = layoutChaveiroArticulado(gl, p);
    const C = M().CrossSection;
    let blocos = C.union(L.pecas.map(x => x.bloco));
    if (!p.semArgola) blocos = blocos.add(L.argola.externo).subtract(L.argola.furo);
    const b0 = blocos.bounds(), cx0 = (b0.min[0] + b0.max[0]) / 2, cy0 = (b0.min[1] + b0.max[1]) / 2;
    const cent = cs => cs && cs.translate([-cx0, -cy0]);
    blocos = cent(blocos);
    // na prévia, as dobradiças aparecem em tom mais escuro (vistas de cima: garfos + língua)
    const J = L.J;
    const juntas = L.juntas.length ? C.union(L.juntas.flatMap(j => {
      const yL0 = j.yc - j.Lm / 2, yL1 = j.yc + j.Lm / 2, g0 = j.yc - j.W / 2, g3 = j.yc + j.W / 2;
      const r = (x0, x1, y0, y1) => C.square([x1 - x0, y1 - y0], false).translate([x0, y0]);
      return [r(j.xj - J.Rk, j.xj + J.Rk, yL0, yL1), r(j.xj - J.Rk, j.xj + J.Rk, g0, yL0 - J.ga), r(j.xj - J.Rk, j.xj + J.Rk, yL1 + J.ga, g3)];
    })) : null;
    const esc = c => [16, 8, 0].reduce((n, s) => n | (Math.round(((c >> s) & 255) * 0.7) << s), 0);
    this.cores.junta = esc(this.cores.base);
    const partes = [{ id: 'base', poligonos: poligonosDe(blocos) }];
    if (juntas) partes.push({ id: 'junta', poligonos: poligonosDe(cent(juntas)) });
    partes.push({ id: 'letras', poligonos: poligonosDe(cent(C.union(L.pecas.map(x => x.letra)))) });
    const bb = blocos.bounds();
    return {
      largura: bb.max[0] - bb.min[0] + 20, altura: bb.max[1] - bb.min[1] + 20, partes,
      dica: `${L.pecas.length} peças ligadas por ${L.juntas.length} dobradiças (as faixas escuras).`,
    };
  },
  async gerar(ctx) {
    const gl = await this.glifos();
    const p = this.parametros();
    const r = geoChaveiroArticulado(gl, p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    const J = juntaArticulada(p);
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Chaveiro articulado ${r.larg.toFixed(0)} × ${r.alt.toFixed(0)} × ${r.alturaTotal.toFixed(1)} mm, ${r.nPecas} peças e ${r.nPecas - 1} juntas. `
        + `Dobradiças com pino Ø ${p.pino.toFixed(1)} mm (folga ${p.folgaRadial.toFixed(2)} mm, lateral ${p.folgaAxial.toFixed(2)} mm), bloco de ${J.hB.toFixed(1)} mm. Imprime sem suporte.`,
    };
  },
});
