import { criarEditorModelo } from './editor.js';
import { comandosParaPoligonos } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoTopoBolo, layoutTopoBolo } from './geo.js';
import { deslizante, escolha, areaTexto, texto, aoMudar, secao } from '../core/ui.js';
import { M } from '../core/motor.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

// uma forma por linha, todas na mesma escala (altura da maiúscula) e com a linha de base em y=0
function linhasDoTexto(font, txt, alturaMaiuscula, fator = 1) {
  const CS = M().CrossSection, tam = 100;
  const ref = font.charToGlyph('H').getPath(0, 0, tam).getBoundingBox();
  const s = alturaMaiuscula / ((ref.y2 - ref.y1) || tam * 0.7);
  return txt.split('\n').map((l, i) => {
    l = l.trim();
    if (!l) return null;
    const polys = comandosParaPoligonos(font.getPath(l, 0, 0, tam).commands);
    const f = i === 0 ? fator : 1;
    return polys.length ? new CS(polys, 'NonZero').scale([s * f, s * f]) : null;
  });
}

export default criarEditorModelo({
  id: 'topo-bolo', nome: 'Topo de Bolo',
  descricao: 'Topo de bolo com texto editável (várias linhas), base que segue o contorno das letras e hastes pontudas pra espetar no bolo.',
  partes: [
    { id: 'base', nome: 'Base + hastes', cor: 0xc8924a },
    { id: 'texto', nome: 'Texto', cor: 0xfdf6ec },
  ],
  montarConteudo(s, ctx, mudou) {
    this.txt = areaTexto(s, 'Texto', 'Feliz\nAniversário', { dica: 'Enter = nova linha.', linhas: 3 });
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Lobster-Regular.ttf', { aoMudar: mudou, dica: 'Fontes cursivas grossas (Lobster, Pacifico) ficam lindas e firmes.' });
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Texto em relevo'], ['rente', 'Texto nivelado']], 'relevo');
    aoMudar([this.txt, this.acabamento], mudou);
    texto(s, 'A base junta todas as letras numa peça só. Imprima deitado.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const st = secao(raiz, 'Texto');
    this.alturaTexto = d(st, 'Altura do texto', 20, { min: 8, max: 60, passo: 0.5, dica: 'Altura de uma letra maiúscula.' });
    this.fatorPrimeira = deslizante(st, 'Tamanho da 1ª linha', 1, { min: 0.6, max: 4, passo: 0.05, un: '×', aoMudar: mudou, dica: 'Ex.: 2,5× pra idade grande ("15" em cima e o nome embaixo).' });
    this.entrelinha = deslizante(st, 'Espaço entre linhas', 1, { min: 0.6, max: 1.6, passo: 0.05, aoMudar: mudou, dica: 'Em relação à altura do texto.' });
    this.engrossar = d(st, 'Engrossar letras', 0, { min: 0, max: 1.5, passo: 0.05 });
    this.relevo = d(st, 'Relevo do texto', 1.5, { min: 0.4, max: 4, passo: 0.1 });

    const sb = secao(raiz, 'Base');
    this.borda = d(sb, 'Largura da borda', 4, { min: 1, max: 10, passo: 0.1 });
    this.espBase = d(sb, 'Espessura da base', 3, { min: 1.6, max: 6, passo: 0.1 });
    this.fecho = d(sb, 'Suavizar contorno', 2, { min: 0, max: 15, passo: 0.5 });

    const sh = secao(raiz, 'Hastes');
    this.nHastes = deslizante(sh, 'Quantidade', 2, { min: 1, max: 4, passo: 1, aoMudar: mudou });
    this.distHastes = d(sh, 'Distância entre as hastes', 38, { min: 0, max: 200, passo: 0.5 });
    this.comprimentoHaste = d(sh, 'Comprimento (abaixo do texto)', 35, { min: 10, max: 120, passo: 0.5 });
    this.larguraHaste = d(sh, 'Largura', 5.5, { min: 2.5, max: 12, passo: 0.1 });
    this.ponta = d(sh, 'Comprimento da ponta', 5, { min: 0, max: 20, passo: 0.5 });
    this.larguraPonta = d(sh, 'Largura na ponta', 1.2, { min: 0.4, max: 5, passo: 0.1 });
  },
  async linhas() {
    const t = (this.txt() || '').trim();
    if (!t) throw new Error('Digite o texto.');
    return linhasDoTexto(await obterFonte(this.fonte()), t, this.alturaTexto(), this.fatorPrimeira());
  },
  parametros() {
    const k = ['alturaTexto', 'fatorPrimeira', 'entrelinha', 'engrossar', 'relevo', 'borda', 'espBase', 'fecho', 'nHastes', 'distHastes', 'comprimentoHaste', 'larguraHaste', 'ponta', 'larguraPonta'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.acabamento = this.acabamento();
    return p;
  },
  async compor2D(ctx) {
    const p = this.parametros();
    const L = layoutTopoBolo({ linhas: await this.linhas() }, p);
    const b = L.corpo.bounds(), c = cs => cs.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]);
    return {
      largura: L.larg + 20, altura: L.alt + 20,
      partes: [{ id: 'base', poligonos: poligonosDe(c(L.corpo)) }, { id: 'texto', poligonos: poligonosDe(c(L.texto)) }],
      dica: `Texto com ${L.textoTam[0].toFixed(0)} × ${L.textoTam[1].toFixed(0)} mm.`
        + (L.soltas ? ' ⚠ Alguma haste não encosta na base: diminua a distância entre as hastes.' : '')
        + (L.fechoUsado > p.fecho ? ` Contorno suavizado em ${L.fechoUsado} mm pra juntar as linhas.` : ''),
    };
  },
  async gerar(ctx) {
    const p = this.parametros();
    const r = geoTopoBolo({ linhas: await this.linhas() }, p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Topo de bolo ${r.L.larg.toFixed(1)} × ${r.L.alt.toFixed(1)} × ${r.alturaTotal.toFixed(1)} mm, ${Math.round(p.nHastes)} haste(s) de ${p.comprimentoHaste} mm.`
        + (r.L.soltas ? ' ⚠ Alguma haste não encosta na base.' : ''),
    };
  },
});
