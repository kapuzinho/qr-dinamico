import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem, tamanho, centralizar } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoLuminaria } from './geo.js';
import { areaTexto, deslizante, escolha, arquivo, aoMudar } from '../core/ui.js';

const poligonosDe = cs => cs.toPolygons();

export default criarEditorModelo({
  id: 'luminaria', nome: 'Luminária',
  descricao: 'Frente luminosa de texto e/ou SVG, com contorno e margem que acendem. Atrás tem furo pra pendurar e recorte pro fio do LED.',
  partes: [
    { id: 'corpo', nome: 'Corpo (contorno)', cor: 0x1c2b36 },
    { id: 'fundo', nome: 'Fundo (cor)', cor: 0x0f7c80 },
    { id: 'arte', nome: 'Arte (acende)', cor: 0xffffff },
  ],
  montarConteudo(s, ctx, mudou) {
    this.svg = null; this.artePosX = 0;
    this.conteudo = escolha(s, 'Conteúdo', [['texto', 'Texto'], ['svg', 'SVG'], ['ambos', 'Texto + SVG']], 'texto');
    this.texto = areaTexto(s, 'Texto', 'Nome', { linhas: 1 });
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Pacifico-Regular.ttf', { aoMudar: mudou });
    arquivo(s, 'SVG ou imagem', '.svg,.png,.jpg,.jpeg', async f => {
      if (/\.svg$/i.test(f.name)) this.svg = { tipo: 'svg', dado: await f.text() };
      else this.svg = { tipo: 'img', dado: await lerImagem(f, 800) };
      mudou();
    }, { aoRemover: () => { this.svg = null; mudou(); } });
    aoMudar([this.conteudo, this.texto], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    this.largura = deslizante(raiz, 'Largura da arte', 150, { min: 40, max: 300, un: 'mm', aoMudar: mudou });
    this.altTexto = deslizante(raiz, 'Altura do texto', 28, { min: 10, max: 80, un: 'mm', aoMudar: mudou });
    this.margemLum = deslizante(raiz, 'Margem luminosa', 4, { min: 1, max: 15, un: 'mm', aoMudar: mudou, dica: 'A faixa de cor que sobra em volta da arte (a parte que acende).' });
    this.contorno = deslizante(raiz, 'Contorno', 2.5, { min: 0.5, max: 8, un: 'mm', aoMudar: mudou, dica: 'A borda escura externa.' });
    this.espTras = deslizante(raiz, 'Espessura de trás', 3, { min: 1.5, max: 8, un: 'mm', aoMudar: mudou, dica: 'A placa opaca de trás, onde ficam o furo da parede e o recorte do fio.' });
    this.espFundo = deslizante(raiz, 'Camada de cor', 1.5, { min: 0.8, max: 5, un: 'mm', aoMudar: mudou });
    this.espArte = deslizante(raiz, 'Camada que acende', 1.5, { min: 0.8, max: 5, un: 'mm', aoMudar: mudou, dica: 'Imprima essa parte em filamento translúcido pra luz passar.' });
    this.furoParede = deslizante(raiz, 'Furo pra parede', 5, { min: 2, max: 12, un: 'mm', aoMudar: mudou });
    this.furoFio = deslizante(raiz, 'Recorte do fio', 5, { min: 2, max: 12, un: 'mm', aoMudar: mudou });
  },
  usaTexto() { return this.conteudo() !== 'svg'; },
  usaSvg() { return this.conteudo() !== 'texto' && !!this.svg; },
  async svgCs() {
    if (!this.usaSvg()) return null;
    if (this.svg.tipo === 'svg') return svgParaSecao(this.svg.dado, { largura: this.conteudo() === 'svg' ? this.largura() : this.largura() * 0.6 });
    return imagemParaSecao(this.svg.dado, { largura: this.conteudo() === 'svg' ? this.largura() : this.largura() * 0.6 });
  },
  async formas() {
    const fonte = await obterFonte(this.fonte());
    const texto = this.usaTexto() && this.texto().trim() ? textoParaSecao(fonte, this.texto(), { altura: this.altTexto() }) : null;
    return { texto, svg: await this.svgCs() };
  },
  parametros() {
    return { margemLuminosa: this.margemLum(), contorno: this.contorno(), espTras: this.espTras(), espFundo: this.espFundo(),
      espArte: this.espArte(), furoParede: this.furoParede(), furoFio: this.furoFio(), artePosX: this.artePosX, artePosY: this.artePosY || 0 };
  },
  async compor2D(ctx) {
    const f = await this.formas();
    if (!f.texto && !f.svg) throw new Error('Digite um texto ou escolha um SVG.');
    const { M } = await import('../core/motor.js');
    // monta a arte igual ao 3D pra prévia
    let arte;
    if (f.texto && f.svg) {
      const t = centralizar(f.texto), th = tamanho(t)[1];
      const s = f.svg;
      const sb = s.bounds();
      const folga = Math.max(this.margemLum() * 0.2, 0.5) + (this.artePosY || 0);
      const sPos = s.translate([this.artePosX - (sb.min[0] + sb.max[0]) / 2, th / 2 + folga - sb.min[1]]);
      arte = t.add(sPos);
    } else arte = centralizar(f.texto || f.svg);
    const ponte = this.margemLum() + 4;
    const fundo = arte.offset(ponte, 'Round', 2, 24).offset(-(ponte - this.margemLum()), 'Round', 2, 24);
    const corpo = fundo.offset(this.contorno(), 'Round', 2, 24);
    const [w, h] = tamanho(corpo);
    return {
      largura: w + 30, altura: h + 30,
      partes: [
        { id: 'corpo', poligonos: poligonosDe(corpo) },
        { id: 'fundo', poligonos: poligonosDe(fundo) },
        { id: 'arte', movel: !!(f.texto && f.svg), poligonos: poligonosDe(arte) },
      ],
      dica: f.texto && f.svg ? 'Arraste pra ajustar. Clique no quadradinho de cor de cada peça pra trocar.' : 'Clique no quadradinho de cor de cada peça pra trocar.',
    };
  },
  arrastar(id, dx, dy) { if (id === 'arte') { this.artePosX += dx; this.artePosY = (this.artePosY || 0) + dy; } },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoLuminaria(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Luminária ${r.W.toFixed(0)} × ${r.H.toFixed(0)} mm. Imprima a "arte" em filamento translúcido. Furo de parede e recorte do fio na placa de trás.`,
    };
  },
});
