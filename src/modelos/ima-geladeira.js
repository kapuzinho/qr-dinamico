import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoIma, layoutIma } from './geo.js';
import { deslizante, numero, arquivo, escolha, el, texto, aoMudar, secao, marcar } from '../core/ui.js';
import { M } from '../core/motor.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);
// tamanhos comuns de ímã de neodímio (diâmetro × espessura)
const TAMANHOS = [[5, 2], [6, 2], [6, 3], [8, 2], [8, 3], [10, 2], [10, 3], [12, 2], [12, 3], [15, 3], [20, 3], [20, 5]];
const COR_IMA = 0x0f3d2e;

export default criarEditorModelo({
  id: 'ima-geladeira', exemplo: ['arte'], nome: 'Ímã de Geladeira (forma da arte)',
  descricao: 'Envie um SVG ou PNG: a peça pega o formato da arte, com borda, e tem bolsões fechados por dentro pros ímãs. O resumo mostra a camada da pausa pra colocar os ímãs.',
  partes: [
    { id: 'base', nome: 'Base / borda', cor: 0x2b3437 },
    { id: 'arte', nome: 'Arte', cor: 0x111111 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    this.offsets = [];
    const mini = el('img', { class: 'miniatura', alt: 'Arte' }); mini.hidden = true;
    const campoArq = arquivo(s, 'Arte (SVG ou PNG)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      if (/\.svg$/i.test(f.name)) this.arte = { tipo: 'svg', dado: await f.text() };
      else this.arte = { tipo: 'img', dado: await lerImagem(f, 900) };
      mini.src = URL.createObjectURL(f); mini.hidden = false; btnLimpar.hidden = false; this.offsets = []; mudou();
    }, { dica: 'O contorno da arte vira o formato do ímã. Partes brancas do SVG são ignoradas.' });
    const btnLimpar = el('button', { class: 'btn-mini', type: 'button', text: 'Remover arte' }); btnLimpar.hidden = true;
    btnLimpar.addEventListener('click', () => { this.arte = null; mini.hidden = true; mini.src = ''; btnLimpar.hidden = true; try { campoArq.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btnLimpar);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Em relevo'], ['rente', 'Rente à base']], 'relevo');

    this.nImas = numero(s, 'Ímãs', 1, { passo: 1, min: 1, max: 6 });
    this.nImas.input.addEventListener('input', () => { this.offsets = []; });
    this.tamIma = escolha(s, 'Tamanho do ímã', [...TAMANHOS.map(([d, e]) => [`${d}x${e}`, `${d} × ${e} mm`]), ['outro', 'Outro (medir)']], '8x2',
      { dica: 'Diâmetro × espessura do ímã redondo. O furo leva a folga de cada lado.' });
    aoMudar([this.limiar, this.acabamento, this.nImas, this.tamIma], mudou);
    texto(s, 'No 2D, arraste o círculo verde pra mudar onde o ímã fica.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sc = secao(raiz, 'Peça');
    this.tamanho = d(sc, 'Tamanho da arte', 60, { min: 20, max: 150, passo: 0.5, dica: 'Maior lado da arte (sem a borda).' });
    this.rotArte = deslizante(sc, 'Rotação da arte', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.borda = d(sc, 'Largura da borda', 3, { min: 0.8, max: 10, passo: 0.1 });
    this.espBase = d(sc, 'Espessura da base', 3.6, { min: 2, max: 10, passo: 0.2, dica: 'Aumenta sozinha se o ímã precisar de mais espaço.' });
    this.relevo = d(sc, 'Relevo da arte', 1, { min: 0.4, max: 4, passo: 0.1 });
    this.fecho = d(sc, 'Suavizar contorno', 1, { min: 0, max: 12, passo: 0.5 });
    this.chanfro = d(sc, 'Chanfro embaixo', 0.3, { min: 0, max: 0.8, passo: 0.1 });

    const si = secao(raiz, 'Ímãs (embutidos)');
    this.diamOutro = d(si, 'Diâmetro do ímã (Outro)', 8, { min: 3, max: 40, passo: 0.1 });
    this.espOutro = d(si, 'Espessura do ímã (Outro)', 2, { min: 0.5, max: 10, passo: 0.1 });
    this.folgaDiam = d(si, 'Folga no diâmetro', 0.3, { min: 0, max: 1, passo: 0.05, dica: 'Somada ao diâmetro (8 mm + 0,3 = furo de 8,3).' });
    this.folgaAltura = d(si, 'Folga na altura', 0.3, { min: 0, max: 1, passo: 0.05 });
    this.piso = d(si, 'Plástico embaixo do ímã', 0.4, { min: 0.2, max: 2, passo: 0.1, dica: 'Fino = ímã mais forte na geladeira. 0,4–0,6 mm.' });
    this.cobertura = d(si, 'Plástico em cima do ímã', 0.8, { min: 0.4, max: 3, passo: 0.2 });
    this.espacoImas = d(si, 'Espaço entre ímãs', 6, { min: 1, max: 60, passo: 0.5 });
    this.margemIma = d(si, 'Distância mínima da borda', 1.6, { min: 0.8, max: 6, passo: 0.1 });
    this.alturaCamada = d(si, 'Altura de camada (fatiador)', 0.2, { min: 0.08, max: 0.32, passo: 0.04, dica: 'Igual à do teu perfil, pra pausa cair na camada certa.' });
    this.primeiraCamada = d(si, 'Primeira camada (fatiador)', 0.2, { min: 0.08, max: 0.4, passo: 0.02 });
    this.pausaNo3mf = marcar(si, 'Pausa já pronta no .3mf', true, { dica: 'O .3mf sai como projeto da Bambu Lab A1 (placa PEI texturizada; o material você escolhe ao baixar) com a pausa e as cores já definidas. Desmarque pra exportar só as peças (aí a pausa é manual).' });
  },
  ima() {
    const t = this.tamIma();
    const [dn, en] = t === 'outro' ? [this.diamOutro(), this.espOutro()] : t.split('x').map(Number);
    return { dn, en, d: dn + this.folgaDiam(), e: en + this.folgaAltura() };
  },
  async arteCs() {
    if (!this.arte) return null;
    return this.arte.tipo === 'svg'
      ? svgParaSecao(this.arte.dado, { largura: 60, ignorarBranco: true })
      : imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 60 });
  },
  async formas() {
    const arte = await this.arteCs();
    if (!arte) throw new Error('Envie a arte (SVG ou PNG): o formato do ímã vem dela.');
    return { arte };
  },
  parametros() {
    const k = ['tamanho', 'rotArte', 'borda', 'espBase', 'relevo', 'fecho', 'chanfro', 'piso', 'cobertura', 'espacoImas', 'margemIma', 'alturaCamada', 'primeiraCamada'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    const im = this.ima();
    p.diamFuro = im.d; p.espIma = im.en; p.folgaAltura = this.folgaAltura();
    p.nImas = Math.max(1, Math.min(6, Math.round(this.nImas() || 1)));
    p.offsets = this.offsets; p.acabamento = this.acabamento();
    return p;
  },
  arrastar(id, dx, dy) {
    const m = /^ima(\d+)$/.exec(id);
    if (!m) return;
    const i = +m[1];
    const o = this.offsets[i] || [0, 0];
    // se o ímã foi empurrado pra dentro, parte da posição real (evita "acumular" fora da peça)
    const real = this._imas?.[i], auto = this._autoImas?.[i];
    const base = real && auto ? [real.x - auto[0], real.y - auto[1]] : o;
    this.offsets[i] = [base[0] + dx, base[1] + dy];
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutIma(f, p);
    // posições automáticas (sem deslocamento) pra converter o arraste
    const auto = layoutIma(f, { ...p, offsets: [] }).imas.map(m => [m.x, m.y]);
    this._imas = L.imas; this._autoImas = auto;
    const C = M().CrossSection;
    const partes = [{ id: 'base', poligonos: poligonosDe(L.base) }, { id: 'arte', poligonos: poligonosDe(L.arte) }];
    L.imas.forEach((m, i) => {
      this.cores['ima' + i] = COR_IMA;
      partes.push({ id: 'ima' + i, movel: true, poligonos: poligonosDe(C.circle(p.diamFuro / 2, 64).translate([m.x, m.y])) });
    });
    const im = this.ima();
    const avisos = [];
    if (L.semEspaco) avisos.push('⚠ A peça é pequena demais pra esse ímã.');
    if (L.sobrepostos) avisos.push('⚠ Ímãs encostando um no outro: afaste ou aumente o espaço.');
    if (L.imas.some(m => m.ajustado)) avisos.push('Algum ímã foi empurrado pra dentro da peça.');
    return {
      largura: L.larg + 20, altura: L.alt + 20, partes,
      dica: `Furo de ${im.d.toFixed(2).replace('.', ',')} mm pra ímã de ${im.dn} × ${im.en} mm. Arraste o círculo verde pra posicionar. ` + avisos.join(' '),
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const r = geoIma(f, p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    const v = x => x.toFixed(2).replace('.', ',');
    const b = r.bolsao, im = this.ima();
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      pausas: this.pausaNo3mf() ? [{ z: b.zPausa, msg: 'Coloque os ímãs nos bolsões' }] : null,
      camadas: { alturaCamada: this.alturaCamada(), primeiraCamada: this.primeiraCamada() },
      resumo: `Ímã ${r.larg.toFixed(0)} × ${r.alt.toFixed(0)} × ${v(r.alturaTotal)} mm (base de ${v(r.espBase)} mm), ${p.nImas} ímã(s) de ${im.dn} × ${im.en} mm.<br>`
        + `Bolsão Ø ${v(p.diamFuro)} mm de ${v(b.zFundo)} a ${v(b.zTopo)} mm.<br>`
        + (this.pausaNo3mf()
          ? `<b>Pausa já incluída no .3mf: camada ${b.camada} (${v(b.zPausa)} mm).</b> Abra no Bambu Studio como projeto (impressora A1, camada ${v(this.alturaCamada())} mm); se trocar a altura de camada no Bambu, ajuste aqui também e exporte de novo. `
          : `<b>Pausa: camada ${b.camada} (${v(b.zPausa)} mm).</b> No Bambu Studio, depois de fatiar, leve o slider até ${v(b.zPausa)} mm, clique com o botão direito no "+" e escolha "Adicionar pausa". `)
        + `Na pausa, encaixe os ímãs no fundo dos bolsões e continue.`,
    };
  },
});
