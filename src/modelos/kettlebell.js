import { criarEditorModelo } from './editor.js';
import { svgPorCores, imagemParaSecao, lerImagem } from '../core/formas.js';
import { deslizante, numero, arquivo, escolha, marcar, el, texto, aoMudar, secao } from '../core/ui.js';
import { paraManifold, M } from '../core/motor.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { prepararGeometria } from '../core/arquivos.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);
const NCORES = 3;
let baseCache = null;

// corpo do peso (kettlebell) pronto, com a face redonda plana em cima: carrega uma vez
async function corpoBase() {
  if (baseCache) return baseCache;
  const buf = await (await fetch('modelos/kettlebell-base.stl')).arrayBuffer();
  const g = prepararGeometria(new STLLoader().parse(buf));
  g.computeBoundingBox(); const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z);
  const man = paraManifold(g), bb = man.boundingBox();
  const topo = bb.max[2];
  const face = man.slice(topo - 0.05);             // contorno da face plana (onde vai a arte)
  const fb = face.bounds();
  baseCache = { man, bb, topo, face, centro: [(fb.min[0] + fb.max[0]) / 2, (fb.min[1] + fb.max[1]) / 2], diam: Math.min(fb.max[0] - fb.min[0], fb.max[1] - fb.min[1]) };
  return baseCache;
}

export default criarEditorModelo({
  id: 'kettlebell', exemplo: ['arte'], nome: 'Chaveiro Peso de Academia',
  descricao: 'Chaveiro em formato de kettlebell (peso de academia) com corpo pronto. Envie sua arte (SVG multicolorido ou PNG) e ela vai pra face redonda da frente, cada cor do SVG numa peça.',
  partes: [
    { id: 'corpo', nome: 'Peso (corpo)', cor: 0x2a2d30 },
    { id: 'arte1', nome: 'Arte – cor 1', cor: 0xc9a14a },
    { id: 'arte2', nome: 'Arte – cor 2 (se houver)', cor: 0xffffff },
    { id: 'arte3', nome: 'Arte – cor 3 (se houver)', cor: 0xe04040 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    const mini = el('img', { class: 'miniatura', alt: 'Arte' }); mini.hidden = true;
    const campo = arquivo(s, 'Arte (SVG multicolorido ou PNG)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      this.arte = /\.svg$/i.test(f.name) ? { tipo: 'svg', dado: await f.text() } : { tipo: 'img', dado: await lerImagem(f, 800) };
      this._coresAplicadas = false;
      mini.src = URL.createObjectURL(f); mini.hidden = false; btn.hidden = false; mudou();
    }, { dica: 'SVG: cada cor de preenchimento vira uma peça (até 3 cores). PNG: uma cor só.' });
    const btn = el('button', { class: 'btn-mini', type: 'button', text: 'Remover arte' }); btn.hidden = true;
    btn.addEventListener('click', () => { this.arte = null; mini.hidden = true; mini.src = ''; btn.hidden = true; try { campo.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btn);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.ignorarBranco = marcar(s, 'Ignorar o branco do SVG', true, { dica: 'Branco vira "furo" e mostra a cor do peso. Desmarque se o branco faz parte da arte.' });
    this.ignorarBranco.input.addEventListener('change', () => { this._coresAplicadas = false; mudou(); });
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Em relevo'], ['rente', 'Rente à face']], 'relevo');
    aoMudar([this.limiar, this.acabamento], mudou);
    texto(s, 'As cores do SVG já entram como cores das peças (dá pra trocar clicando nelas). Sem arte, sai só o peso.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sa = secao(raiz, 'Arte na face');
    this.tamArte = d(sa, 'Tamanho da arte', 15, { min: 4, max: 30, passo: 0.25, dica: 'Maior lado. A face redonda tem ~20 mm; a arte é cortada 0,8 mm antes da borda.' });
    this.relevo = d(sa, 'Relevo', 0.6, { min: 0.2, max: 2, passo: 0.1 });
    this.rotArte = deslizante(sa, 'Rotação', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.arteX = d(sa, 'Ajuste horizontal', 0, { min: -10, max: 10, passo: 0.25 });
    this.arteY = d(sa, 'Ajuste vertical', 0, { min: -10, max: 10, passo: 0.25 });
  },
  // grupos de cor da arte, já posicionados na face: [{ id, cor, cs }]
  async camadas(base) {
    if (!this.arte) return [];
    const C = M().CrossSection;
    let grupos;
    if (this.arte.tipo === 'svg') grupos = svgPorCores(this.arte.dado, { ignorarBranco: this.ignorarBranco(), maxCores: NCORES });
    else grupos = [{ cor: null, cs: imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 20 }) }];
    const tudo = C.union(grupos.map(g => g.cs)), b = tudo.bounds();
    const e = this.tamArte() / Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
    const c0 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
    const limite = base.face.offset(-0.8, 'Round', 2, 48);
    const pos = cs => {
      let r = cs.translate([-c0[0], -c0[1]]).scale([e, e]);
      if (this.rotArte()) r = r.rotate(this.rotArte());
      return r.translate([base.centro[0] + this.arteX(), base.centro[1] + this.arteY()]).intersect(limite);
    };
    // cores do SVG viram as cores das peças (uma vez por arte enviada)
    if (!this._coresAplicadas) {
      grupos.forEach((g, i) => { if (g.cor !== null) this.cores['arte' + (i + 1)] = g.cor; });
      this._coresAplicadas = true;
      this.pintarChips?.();
    }
    return grupos.map((g, i) => ({ id: 'arte' + (i + 1), cs: pos(g.cs) })).filter(g => !g.cs.isEmpty());
  },
  async compor2D(ctx) {
    const base = await corpoBase();
    const silhueta = base.man.project();     // contorno do peso visto de cima
    const camadas = await this.camadas(base);
    const C = M().CrossSection;
    const esc = (c, k) => [16, 8, 0].reduce((n, s) => n | (Math.round(((c >> s) & 255) * k) << s), 0);
    this.cores.face = esc(this.cores.corpo, 1.35) & 0xffffff;
    const partes = [
      { id: 'corpo', poligonos: poligonosDe(silhueta) },
      { id: 'face', poligonos: poligonosDe(base.face) },
      ...camadas.map(c => ({ id: c.id, poligonos: poligonosDe(c.cs) })),
    ];
    const bb = base.bb;
    return {
      largura: bb.max[0] - bb.min[0] + 20, altura: bb.max[1] - bb.min[1] + 20, partes,
      dica: this.arte ? `${camadas.length} cor(es) na arte. O círculo mais claro é a face plana do peso.` : 'Envie uma arte pra face redonda do peso.',
    };
  },
  async gerar(ctx) {
    const base = await corpoBase();
    const camadas = await this.camadas(base);
    const t = base.topo;
    let corpo = base.man;
    const partes = [];
    if (this.acabamento() === 'rente') {
      const pr = Math.min(this.relevo(), 1.5);
      const todas = camadas.length ? M().CrossSection.union(camadas.map(c => c.cs)) : null;
      if (todas) corpo = corpo.subtract(todas.extrude(pr + 0.01).translate([0, 0, t - pr]));
      partes.push(['corpo', corpo]);
      camadas.forEach(c => partes.push([c.id, c.cs.extrude(pr).translate([0, 0, t - pr])]));
    } else {
      partes.push(['corpo', corpo]);
      camadas.forEach(c => partes.push([c.id, c.cs.extrude(this.relevo()).translate([0, 0, t])]));
    }
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2, bb = base.bb;
    return {
      partes,
      montado: partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Peso ${(bb.max[0] - bb.min[0]).toFixed(1)} × ${(bb.max[1] - bb.min[1]).toFixed(1)} × ${(t + (this.acabamento() === 'rente' ? 0 : this.relevo())).toFixed(1)} mm, `
        + `${camadas.length ? camadas.length + ' cor(es) de arte na face (Ø ' + base.diam.toFixed(0) + ' mm)' : 'sem arte'}. Imprime deitado, com a face pra cima.`,
    };
  },
});
