import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoLitofania } from './geo.js';
import { deslizante, arquivo, escolha, marcar, areaTexto, campoTexto, texto, aoMudar, secao } from '../core/ui.js';
import { M } from '../core/motor.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'litofania', nome: 'Luminária Lithophane (foto ou nome)',
  descricao: 'Painel que mostra a imagem quando tem luz atrás: use uma FOTO (vira relevo de espessura) ou um NOME/arte em camadas. Imprima em branco; fica em pé numa base com rasgo.',
  partes: [
    { id: 'placa', nome: 'Painel (use branco)', cor: 0xf4f1ea },
    { id: 'base', nome: 'Base', cor: 0x2a2d31 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.foto = null; this.arte = null;
    this.modo = escolha(s, 'O que vai no painel', [['foto', 'Foto (lithophane de verdade)'], ['texto', 'Nome / arte em camadas']], 'texto');
    arquivo(s, 'Foto (JPG ou PNG)', '.png,.jpg,.jpeg,.webp', async f => { this.foto = await lerImagem(f, 700); mudou(); },
      { dica: 'Fotos com rosto bem iluminado e fundo simples ficam melhores.', aoRemover: () => { this.foto = null; mudou(); }, galeria: false });
    this.legenda = campoTexto(s, 'Legenda embaixo da foto (opcional)', '', { placeholder: 'ex.: Helena • 2026', dica: 'Vira um porta-retrato com o nome embaixo (só no modo Foto).' });
    this.txt = areaTexto(s, 'Nome / frase', 'Alan', { linhas: 2, dica: 'Enter = nova linha.' });
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Pacifico-Regular.ttf', { aoMudar: mudou });
    arquivo(s, 'Arte acima do nome (SVG, opcional)', '.svg', async f => { this.arte = await f.text(); mudou(); }, { aoRemover: () => { this.arte = null; mudou(); } });
    this.inverter = marcar(s, 'Inverter claro/escuro', false, { dica: 'Foto: troca negativo/positivo. Nome: o nome fica claro e o fundo escuro.' });
    aoMudar([this.modo, this.txt, this.legenda], mudou);
    texto(s, 'Imprima o painel EM PÉ ou deitado, em branco, com 100% de preenchimento e paredes finas: quanto mais grosso, mais escuro aparece na luz.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sp = secao(raiz, 'Painel');
    this.largura = d(sp, 'Largura', 100, { min: 40, max: 200, passo: 1 });
    this.altura = d(sp, 'Altura', 75, { min: 30, max: 200, passo: 1 });
    this.moldura = d(sp, 'Moldura', 4, { min: 1, max: 15, passo: 0.5 });
    this.raio = d(sp, 'Cantos', 4, { min: 0, max: 20, passo: 0.5 });
    this.espMin = d(sp, 'Espessura mínima (claro)', 0.8, { min: 0.4, max: 2, passo: 0.1 });
    this.espMax = d(sp, 'Espessura máxima (escuro)', 3, { min: 1.5, max: 6, passo: 0.1 });
    this.espMoldura = d(sp, 'Espessura da moldura', 4, { min: 2, max: 10, passo: 0.2 });
    const sf = secao(raiz, 'Foto');
    this.resolucao = d(sf, 'Detalhe (tamanho do ponto)', 0.4, { min: 0.2, max: 1, passo: 0.05, dica: 'Menor = mais detalhe e arquivo maior. 0,3–0,5 mm é o ideal.' });
    this.contraste = deslizante(sf, 'Contraste', 1, { min: 0.5, max: 2.5, passo: 0.05, aoMudar: mudou });
    this.alturaLegenda = d(sf, 'Altura da legenda', 9, { min: 4, max: 30, passo: 0.5 });
    const st = secao(raiz, 'Nome / arte');
    this.tamTexto = d(st, 'Largura do nome', 80, { min: 20, max: 190, passo: 1 });
    this.tamArte = d(st, 'Tamanho da arte', 30, { min: 5, max: 150, passo: 1 });
    this.engrossar = d(st, 'Engrossar', 0.3, { min: 0, max: 2, passo: 0.05 });
    const sb = secao(raiz, 'Base');
    this.altBase = d(sb, 'Altura da base', 15, { min: 10, max: 40, passo: 0.5, dica: 'Dá pra deixar mais alta e colocar um LED/vela de LED atrás.' });
    this.profBase = d(sb, 'Profundidade da base', 30, { min: 14, max: 80, passo: 1 });
    this.folgaBase = d(sb, 'Folga do encaixe', 0.3, { min: 0.1, max: 0.8, passo: 0.05 });
  },
  async forma2D() {
    const C = M().CrossSection, partes = [];
    const t = (this.txt() || '').trim();
    if (t) { let cs = textoParaSecao(await obterFonte(this.fonte()), t, { altura: 10 }); const b = cs.bounds(); const s = this.tamTexto() / (b.max[0] - b.min[0]); partes.push(cs.scale([s, s])); }
    if (this.arte) { let a = svgParaSecao(this.arte, { largura: 30, ignorarBranco: true }); const b = a.bounds(); const s = this.tamArte() / Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]); partes.unshift(a.scale([s, s])); }
    if (!partes.length) throw new Error('Digite um nome ou envie uma arte.');
    // empilha (arte em cima, nome embaixo) e centraliza
    let y = 0; const pos = [];
    for (const cs of partes) { const b = cs.bounds(); pos.push(cs.translate([-(b.min[0] + b.max[0]) / 2, y - b.max[1]])); y -= (b.max[1] - b.min[1]) + 4; }
    const tudo = C.union(pos), b = tudo.bounds();
    return tudo.translate([0, -(b.min[1] + b.max[1]) / 2]);
  },
  async fonte3D() {
    if (this.modo() === 'foto') {
      if (!this.foto) throw new Error('Envie uma foto (JPG ou PNG).');
      const lg = (this.legenda() || '').trim();
      return { imagem: this.foto, legenda: lg ? textoParaSecao(await obterFonte(this.fonte()), lg, { altura: 10 }) : null };
    }
    return { forma: await this.forma2D() };
  },
  parametros() {
    const k = ['largura', 'altura', 'moldura', 'raio', 'espMin', 'espMax', 'espMoldura', 'resolucao', 'contraste', 'alturaLegenda', 'engrossar', 'altBase', 'profBase', 'folgaBase'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.inverter = !!this.inverter();
    p.espMax = Math.max(p.espMax, p.espMin + 0.4);
    return p;
  },
  async compor2D(ctx) {
    const p = this.parametros(), C = M().CrossSection;
    const W = p.largura, H = p.altura, Wi = W - 2 * p.moldura, Hi = H - 2 * p.moldura;
    const esc = (c, k) => [16, 8, 0].reduce((n, s) => n | (Math.round(((c >> s) & 255) * k) << s), 0);
    this.cores.escuro = esc(this.cores.placa, 0.35);
    const partes = [{ id: 'placa', poligonos: poligonosDe(C.square([W, H], true)) }];
    if (this.modo() === 'texto') {
      const f = (await this.forma2D()).intersect(C.square([Wi, Hi], true));
      // simula a luz atrás: grosso = escuro
      if (p.inverter) partes.push({ id: 'escuro', poligonos: poligonosDe(C.square([Wi, Hi], true).subtract(f)) });
      else partes.push({ id: 'escuro', poligonos: poligonosDe(f) });
    }
    return {
      largura: W + 20, altura: H + 20, partes,
      dica: this.modo() === 'foto' ? (this.foto ? 'A foto vira relevo: veja o resultado em "Visualizar em 3D" (com luz atrás aparece a imagem).' : 'Envie uma foto.')
        : 'Simulação com luz atrás: o escuro é a parte mais grossa.',
    };
  },
  async gerar(ctx) {
    const p = this.parametros();
    const r = geoLitofania(await this.fonte3D(), p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.montado, montado: r.montado.map(([id, m]) => [id, m, [cx, cy, 0]]), imprimir: r.imprimir,
      resumo: `Painel ${p.largura} × ${p.altura} mm, espessura ${p.espMin}–${p.espMax} mm (moldura ${r.espTotal} mm). Fenda da base ${r.fenda.L.toFixed(1)} × ${r.fenda.E.toFixed(1)} mm. `
        + 'Imprima o painel em branco com 100% de preenchimento; os arquivos saem com painel e base deitados.',
    };
  },
});
