import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoChaveiroRedondo } from './geo.js';
import { deslizante, numero, arquivo, el, texto } from '../core/ui.js';

const poligonosDe = cs => cs.toPolygons();

export default criarEditorModelo({
  id: 'chaveiro-redondo', exemplo: ['frente'], nome: 'Chaveiro redondo',
  descricao: 'Medalha redonda com argola, disco e a arte no meio. Envie SVG ou PNG pra cada lado — podem ser diferentes. SVG fica mais nítido.',
  partes: [
    { id: 'moldura', nome: 'Moldura e argola', cor: 0x8a99a3 },
    { id: 'fundo', nome: 'Disco (fundo)', cor: 0xe3a53a },
    { id: 'arteFrente', nome: 'Arte da frente', cor: 0x1c2b36 },
    { id: 'arteVerso', nome: 'Arte do verso', cor: 0x1c2b36 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.frente = null; this.verso = null;
    const upload = (rotulo, campo) => {
      arquivo(s, rotulo, '.svg,.png,.jpg,.jpeg,.webp', async f => {
        if (/\.svg$/i.test(f.name)) this[campo] = { tipo: 'svg', dado: await f.text() };
        else this[campo] = { tipo: 'img', dado: await lerImagem(f, 800) };
        mudou();
      }, { aoRemover: () => { this[campo] = null; mudou(); } });
    };
    upload('Arte da frente (SVG ou PNG)', 'frente');
    upload('Arte do verso (opcional)', 'verso');
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254, dica: 'Pra PNG/JPG: o que for mais escuro que isso vira o desenho. SVG ignora.' });
    this.limiar.input.addEventListener('input', mudou);
    texto(s, 'SVG fica mais nítido. Pra PNG, use um logo com fundo transparente.');
  },
  montarParametros(raiz, ctx, mudou) {
    this.diametro = deslizante(raiz, 'Diâmetro do disco', 40, { min: 20, max: 90, un: 'mm', aoMudar: mudou });
    this.moldura = deslizante(raiz, 'Moldura', 4, { min: 1.5, max: 12, un: 'mm', aoMudar: mudou });
    this.margemArte = deslizante(raiz, 'Margem da arte', 3, { min: 0, max: 12, un: 'mm', aoMudar: mudou, dica: 'Folga entre a arte e a moldura.' });
    this.espDisco = deslizante(raiz, 'Espessura do disco', 2, { min: 1, max: 6, un: 'mm', aoMudar: mudou });
    this.espArte = deslizante(raiz, 'Relevo da arte', 1.5, { min: 0.6, max: 4, un: 'mm', aoMudar: mudou });
    this.argola = deslizante(raiz, 'Tamanho da argola', 8, { min: 4, max: 16, un: 'mm', aoMudar: mudou });
  },
  async arteDe(fonte) {
    if (!fonte) return null;
    const cheio = fonte.tipo === 'svg'
      ? svgParaSecao(fonte.dado, { largura: 60, ignorarBranco: false })
      : imagemParaSecao(fonte.dado, { limiar: this.limiar(), largura: 60 });
    return { cheio };
  },
  async formas() {
    if (!this.frente) throw new Error('Escolha a arte da frente (SVG ou PNG).');
    return { frente: await this.arteDe(this.frente), verso: await this.arteDe(this.verso) };
  },
  parametros() {
    return { diametro: this.diametro(), moldura: this.moldura(), margemArte: this.margemArte(), espDisco: this.espDisco(),
      espArte: this.espArte(), argola: this.argola() };
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const { M } = await import('../core/motor.js');
    const rD = this.diametro() / 2, rA = rD + this.moldura();
    const disco = M().CrossSection.circle(rD, 96);
    const aro = M().CrossSection.circle(rA, 96);
    const a = f.frente.cheio, ab = a.bounds();
    const esc = (rD - this.margemArte()) * 2 / Math.max(ab.max[0] - ab.min[0], ab.max[1] - ab.min[1]);
    const centr = m => { const b = m.bounds(); return m.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]); };
    const arte = centr(a.scale([esc, esc])).intersect(disco);
    return {
      largura: 2 * rA + 20, altura: 2 * rA + this.argola() * 3,
      partes: [
        { id: 'moldura', poligonos: poligonosDe(aro) },
        { id: 'fundo', poligonos: poligonosDe(disco) },
        { id: 'arteFrente', poligonos: poligonosDe(arte) },
      ],
      dica: 'Prévia da frente. Clique no quadradinho de cor de cada peça pra trocar.',
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoChaveiroRedondo(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Chaveiro redondo ${r.W.toFixed(0)} mm${f.verso ? ', frente e verso' : ''}. Imprime deitado; a argola passa o chaveiro.`,
    };
  },
});
