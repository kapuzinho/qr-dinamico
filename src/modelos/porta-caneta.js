import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem, tamanho, centralizar } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoPortaCaneta, larg, alt, centroX } from './geo.js';
import { areaTexto, deslizante, escolha, arquivo, aoMudar } from '../core/ui.js';

const poligonosDe = cs => cs.toPolygons();

export default criarEditorModelo({
  id: 'porta-caneta', nome: 'Porta caneta',
  descricao: 'Porta caneta que segue o texto e o SVG. O texto define a largura; arraste o SVG pra posicionar em cima. Corpo, fundo e divisórias acompanham.',
  partes: [
    { id: 'corpo', nome: 'Corpo', cor: 0x0f7c80 },
    { id: 'texto', nome: 'Texto', cor: 0xffffff },
    { id: 'arte', nome: 'Arte (SVG)', cor: 0x2ec4e6 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.svg = null;
    this.artePosX = 0;
    this.conteudo = escolha(s, 'Conteúdo', [['texto', 'Só texto'], ['svg', 'Só SVG'], ['ambos', 'Texto + SVG']], 'ambos');
    this.texto = areaTexto(s, 'Texto', 'Nome', { linhas: 1 });
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Pacifico-Regular.ttf', { aoMudar: mudou });
    arquivo(s, 'SVG ou imagem', '.svg,.png,.jpg,.jpeg', async f => {
      if (/\.svg$/i.test(f.name)) this.svg = { tipo: 'svg', dado: await f.text() };
      else this.svg = { tipo: 'img', dado: await lerImagem(f, 700) };
      this.artePosX = 0;
      mudou();
    }, { aoRemover: () => { this.svg = null; this.artePosX = 0; mudou(); } });
    aoMudar([this.conteudo, this.texto], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    this.acab = escolha(raiz, 'Acabamento do texto', [['relevo', 'Em relevo'], ['rente', 'Rente à parede']], 'relevo');
    this.artePosXsl = deslizante(raiz, 'SVG - horizontal', 0, { min: -60, max: 60, un: 'mm', aoMudar: () => { this.artePosX = this.artePosXsl(); mudou(); }, dica: 'Desliza o SVG pros lados. No 2D também dá pra arrastar.' });
    this.artePosYsl = deslizante(raiz, 'SVG - altura sobre o nome', 0, { min: -40, max: 60, un: 'mm', aoMudar: mudou, dica: 'Sobe ou desce o SVG em relação ao nome.' });
    this.altTexto = deslizante(raiz, 'Altura do texto', 30, { min: 12, max: 70, un: 'mm', aoMudar: mudou });
    this.altSvg = deslizante(raiz, 'Altura do SVG', 75, { min: 15, max: 140, un: 'mm', aoMudar: mudou, dica: 'Deixe maior que a caixa pra ele aparecer em pé acima dos compartimentos.' });
    this.altura = deslizante(raiz, 'Altura da caixa', 55, { min: 30, max: 120, un: 'mm', aoMudar: mudou });
    this.prof = deslizante(raiz, 'Profundidade', 70, { min: 40, max: 120, un: 'mm', aoMudar: mudou });
    this.compart = deslizante(raiz, 'Compartimentos', 4, { min: 1, max: 8, passo: 1, aoMudar: mudou });
    this.parede = deslizante(raiz, 'Parede', 2.5, { min: 1.2, max: 5, un: 'mm', aoMudar: mudou });
    this.piso = deslizante(raiz, 'Fundo', 3, { min: 1.2, max: 6, un: 'mm', aoMudar: mudou });
    this.elevarNome = deslizante(raiz, 'Nome - altura do chão', 6, { min: 0, max: 40, un: 'mm', aoMudar: mudou, dica: 'Sobe o nome (e todo o conjunto da frente) pra ele não encostar na mesa.' });
    this.contornoTexto = deslizante(raiz, 'Contorno do nome', 1.5, { min: 0.5, max: 10, un: 'mm', aoMudar: mudou, dica: 'Quanto a base escura sobra em volta das letras. Menor = mais justo.' });
    this.contornoArte = deslizante(raiz, 'Contorno do SVG', 2.5, { min: 0.5, max: 10, un: 'mm', aoMudar: mudou });
    this.margem = deslizante(raiz, 'Margem estrutural', 8, { min: 2, max: 25, un: 'mm', aoMudar: mudou });
    this.raio = deslizante(raiz, 'Cantos', 6, { min: 0, max: 20, un: 'mm', aoMudar: mudou });
    this.relevoTexto = deslizante(raiz, 'Relevo do texto', 1.5, { min: 0.6, max: 4, un: 'mm', aoMudar: mudou });
    this.relevoArte = deslizante(raiz, 'Relevo do SVG', 2, { min: 0.6, max: 5, un: 'mm', aoMudar: mudou });
    aoMudar([this.acab], mudou);
  },
  usaTexto() { return this.conteudo() !== 'svg'; },
  usaSvg() { return this.conteudo() !== 'texto' && !!this.svg; },
  async svgCs() {
    if (!this.usaSvg()) return null;
    if (this.svg.tipo === 'svg') return svgParaSecao(this.svg.dado, { altura: this.altSvg() });
    return imagemParaSecao(this.svg.dado, { altura: this.altSvg(), largura: 0 });
  },
  async formas() {
    const fonte = await obterFonte(this.fonte());
    return {
      texto: this.usaTexto() && this.texto().trim() ? textoParaSecao(fonte, this.texto(), { altura: this.altTexto() }) : null,
      svg: await this.svgCs(),
    };
  },
  parametros() {
    return { margem: this.margem(), profundidade: this.prof(), altura: this.altura(), parede: this.parede(), piso: this.piso(),
      raio: this.raio(), compartimentos: this.compart(), relevoTexto: this.relevoTexto(), relevoArte: this.relevoArte(),
      artePosX: this.artePosX, artePosY: this.artePosYsl(), contornoTexto: this.contornoTexto(), contornoArte: this.contornoArte(), elevarNome: this.elevarNome() };
  },
  // arraste do SVG no 2D: move só em X
  arrastar(id, dx) { if (id === 'arte') { this.artePosX += dx; this.artePosXsl.definir(Math.round(this.artePosX)); } },
  async compor2D(ctx) {
    const f = await this.formas();
    if (!f.texto && !f.svg) throw new Error('Digite um texto ou escolha um SVG.');
    const { retArred } = await import('./geo.js');
    const th = f.texto ? alt(f.texto) : 0;
    const partes = [];
    // frente: nome embaixo, svg acima (representação da silhueta)
    if (f.texto) {
      partes.push({ id: 'corpo', poligonos: poligonosDe(centroX(f.texto, 0, 0).offset(this.contornoTexto(), 'Round', 2, 16)) });
      partes.push({ id: 'texto', poligonos: poligonosDe(centroX(f.texto, 0, 0)) });
    }
    if (f.svg) {
      const yBase = (f.texto ? th + Math.max(this.contornoTexto() + this.contornoArte() + 0.5, 3) : 0) + this.artePosYsl();
      const sPos = centroX(f.svg, 0, yBase).translate([this.artePosX, 0]);
      partes.unshift({ id: 'corpo', poligonos: poligonosDe(sPos.offset(this.contornoArte(), 'Round', 2, 16)) });
      partes.push({ id: 'arte', movel: true, poligonos: poligonosDe(sPos) });
    }
    const totalH = (f.texto ? th : 0) + (f.svg ? alt(f.svg) + this.artePosYsl() : 0) + 20;
    return { largura: (f.texto ? larg(f.texto) : larg(f.svg)) + 2 * this.margem() + 30, altura: totalH, partes,
      dica: 'Arraste o SVG pra posicionar. Clique no quadradinho de cor de cada peça pra trocar.' };
  },
  async gerar(ctx) {
    const f = await this.formas();
    if (!f.texto && !f.svg) throw new Error('Digite um texto ou escolha um SVG.');
    const r = geoPortaCaneta(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Porta caneta ${r.W.toFixed(0)} × ${r.D.toFixed(0)} × ${r.H.toFixed(0)} mm, ${Math.round(this.compart())} compartimento(s).`,
    };
  },
});
