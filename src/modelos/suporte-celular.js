import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { deslizante, numero, arquivo, el, texto } from '../core/ui.js';
import { paraManifold, paraGeometria, M } from '../core/motor.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { prepararGeometria } from '../core/arquivos.js';

const poligonosDe = cs => cs.toPolygons();
let baseCache = null;

// carrega o STL base (abridor funcional) uma vez e vira Manifold
async function corpoBase() {
  if (baseCache) return baseCache;
  const buf = await (await fetch('modelos/suporte-celular-base.stl')).arrayBuffer();
  let g = prepararGeometria(new STLLoader().parse(buf));
  g.computeBoundingBox(); const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z);
  const man = paraManifold(g);
  const bb = man.boundingBox();
  baseCache = { man, bb };
  return baseCache;
}

export default criarEditorModelo({
  id: 'suporte-celular', exemplo: ['frente'], nome: 'Suporte celular',
  descricao: 'Suporte de celular chaveiro. O corpo é funcional pronto; você só troca a arte (SVG ou PNG) e a cor. Frente e verso.',
  partes: [
    { id: 'corpo', nome: 'Corpo', cor: 0x2f5d50 },
    { id: 'arteFrente', nome: 'Arte da frente', cor: 0x1a1a1a },
    { id: 'arteVerso', nome: 'Arte do verso', cor: 0x1a1a1a },
  ],
  montarConteudo(s, ctx, mudou) {
    this.frente = null; this.verso = null;
    const upload = (rotulo, campo) => {
      const mini = el('img', { class: 'miniatura', alt: rotulo });
      mini.hidden = true;
      const campoArq = arquivo(s, rotulo, '.svg,.png,.jpg,.jpeg,.webp', async f => {
        if (/\.svg$/i.test(f.name)) this[campo] = { tipo: 'svg', dado: await f.text() };
        else this[campo] = { tipo: 'img', dado: await lerImagem(f, 800) };
        mini.src = URL.createObjectURL(f); mini.hidden = false;
        btnLimpar.hidden = false;
        mudou();
      });
      const btnLimpar = el('button', { class: 'btn-mini', type: 'button', text: `Remover ${rotulo.includes('verso') ? 'verso' : 'frente'}` });
      btnLimpar.hidden = true;
      btnLimpar.addEventListener('click', () => {
        this[campo] = null; mini.hidden = true; mini.src = ''; btnLimpar.hidden = true;
        try { campoArq.value = ''; } catch {}
        mudou();
      });
      s.append(mini); s.append(btnLimpar);
    };
    upload('Arte da frente (SVG ou PNG)', 'frente');
    upload('Arte do verso (opcional)', 'verso');
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254, dica: 'Pra PNG/JPG. SVG ignora.' });
    this.limiar.input.addEventListener('input', mudou);
    texto(s, 'Começa LISO. Carregue uma arte só se quiser; use "Remover" pra voltar ao liso.');
  },
  montarParametros(raiz, ctx, mudou) {
    this.larguraArte = deslizante(raiz, 'Tamanho da arte', 20, { min: 8, max: 35, un: 'mm', aoMudar: mudou });
    this.posX = deslizante(raiz, 'Posição horizontal', 0, { min: -20, max: 20, un: 'mm', aoMudar: mudou });
    this.posY = deslizante(raiz, 'Posição vertical', 0, { min: -10, max: 10, un: 'mm', aoMudar: mudou });
    this.giro = deslizante(raiz, 'Girar a arte', 0, { min: -180, max: 180, passo: 5, un: '°', aoMudar: mudou, dica: 'Gira o desenho pra qualquer direção.' });
    this.relevo = deslizante(raiz, 'Relevo da arte', 1.2, { min: 0.6, max: 3, un: 'mm', aoMudar: mudou, dica: 'Quanto a arte sobe acima do corpo.' });
    this.rebaixo = deslizante(raiz, 'Afundar no corpo', 0.6, { min: 0, max: 2, un: 'mm', aoMudar: mudou, dica: 'Quanto a arte entra no corpo (encaixe da cor). 0 = só em cima.' });
  },
  async arteCs(fonte) {
    if (!fonte) return null;
    return fonte.tipo === 'svg'
      ? svgParaSecao(fonte.dado, { largura: 60, ignorarBranco: false })
      : imagemParaSecao(fonte.dado, { limiar: this.limiar(), largura: 60 });
  },
  async arteNaArea(cs, bb, ehVerso) {
    // escala pra caber no tamanho pedido, centraliza na área esquerda do corpo
    const b = cs.bounds();
    const esc = this.larguraArte() / Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
    let a = cs.scale([esc, esc]);
    if (this.giro && this.giro()) a = a.rotate(this.giro());  // gira a arte
    const b2 = a.bounds();
    // área da arte: lado esquerdo do corpo (onde é liso)
    const cxArte = (bb.min[0] + bb.max[0]) / 2 + this.posX();
    const cyArte = (bb.min[1] + bb.max[1]) / 2 + this.posY();
    a = a.translate([cxArte - (b2.min[0] + b2.max[0]) / 2, cyArte - (b2.min[1] + b2.max[1]) / 2]);
    if (ehVerso) a = a.mirror([1, 0]).translate([2 * cxArte, 0]);
    return a;
  },
  async formas() {
    return { frente: this.frente ? await this.arteCs(this.frente) : null, verso: this.verso ? await this.arteCs(this.verso) : null };
  },
  async compor2D(ctx) {
    const { bb } = await corpoBase();
    const f = await this.formas();
    const cs = M().CrossSection;
    const corpoSilhueta = cs.square([bb.max[0] - bb.min[0], bb.max[1] - bb.min[1]], true);
    const partes = [{ id: 'corpo', poligonos: poligonosDe(corpoSilhueta) }];
    if (f.frente) partes.push({ id: 'arteFrente', poligonos: poligonosDe(await this.arteNaArea(f.frente, bb, false)) });
    return {
      largura: (bb.max[0] - bb.min[0]) + 20, altura: (bb.max[1] - bb.min[1]) + 20,
      partes,
      dica: f.frente ? 'Ajuste a arte e a cor. Clique no quadradinho de cor.' : 'Abridor liso. Adicione uma arte se quiser, ou deixe sem.',
    };
  },
  async gerar(ctx) {
    const { man, bb } = await corpoBase();
    const f = await this.formas();
    const Man = M().Manifold;
    const zTopo = bb.max[2];
    const relevo = this.relevo(), rebaixo = this.rebaixo();

    const fazerArte = (cs, ehVerso) => {
      // extruda a arte: entra 'rebaixo' no corpo e sobe 'relevo' acima
      const alt = rebaixo + relevo;
      let a = cs.extrude(alt);
      if (ehVerso) a = a.translate([0, 0, 0]);         // verso na base (z=0 pra baixo)
      return a;
    };

    let corpo = man.asOriginal ? man.asOriginal() : Man.compose([man]);  // cópia, não consome o cache
    let arteF = null, arteV = null;
    if (f.frente) {
      const arteF2d = await this.arteNaArea(f.frente, bb, false);
      arteF = arteF2d.extrude(relevo + rebaixo).translate([0, 0, zTopo - rebaixo]);
      corpo = corpo.subtract(arteF2d.extrude(rebaixo + 0.01).translate([0, 0, zTopo - rebaixo])); // bolso
    }
    if (f.verso) {
      const arteV2d = await this.arteNaArea(f.verso, bb, true);
      arteV = arteV2d.extrude(relevo + rebaixo).translate([0, 0, -relevo]);
      corpo = corpo.subtract(arteV2d.extrude(rebaixo + 0.01).translate([0, 0, 0]));
    }
    const partes3d = [['corpo', corpo]];
    if (arteF) partes3d.push(['arteFrente', arteF]);
    if (arteV) partes3d.push(['arteVerso', arteV]);

    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: partes3d,
      montado: partes3d.map(([id, mm]) => [id, paraGeometria ? mm : mm, [cx, cy, 0]]),
      resumo: `Suporte celular${f.frente ? (f.verso ? ', frente e verso' : ', com arte') : ' (liso)'}. Imprime deitado.`,
    };
  },
});
