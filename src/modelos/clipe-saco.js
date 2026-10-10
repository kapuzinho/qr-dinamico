import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoClipeSaco, layoutClipeSaco } from './geo.js';
import { deslizante, numero, arquivo, escolha, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'clipe-saco', exemplo: ['arte'], nome: 'Clipe de Saco (forma da arte)',
  descricao: 'Clipe de saco funcional (mola em W que prende a boca do saco) com a parte de cima no formato da sua arte (SVG ou PNG), em relevo ou nivelada.',
  partes: [
    { id: 'corpo', nome: 'Corpo', cor: 0x263238 },
    { id: 'arte', nome: 'Arte', cor: 0x0d0d0d },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    const mini = el('img', { class: 'miniatura', alt: 'Arte' }); mini.hidden = true;
    const campo = arquivo(s, 'Arte da parte de cima (SVG ou PNG)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      this.arte = /\.svg$/i.test(f.name) ? { tipo: 'svg', dado: await f.text() } : { tipo: 'img', dado: await lerImagem(f, 900) };
      mini.src = URL.createObjectURL(f); mini.hidden = false; btn.hidden = false; mudou();
    }, { dica: 'O contorno da arte vira a cabeça do clipe.' });
    const btn = el('button', { class: 'btn-mini', type: 'button', text: 'Remover arte' }); btn.hidden = true;
    btn.addEventListener('click', () => { this.arte = null; mini.hidden = true; mini.src = ''; btn.hidden = true; try { campo.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btn);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Elevada (relevo)'], ['rente', 'Nivelada']], 'relevo');
    aoMudar([this.limiar, this.acabamento], mudou);
    texto(s, 'Dobre a boca do saco e encaixe entre as hastes da mola. Imprima deitado; a espessura é a altura do clipe na mesa.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sa = secao(raiz, 'Cabeça (arte)');
    this.tamanho = d(sa, 'Largura da arte', 30, { min: 10, max: 80, passo: 0.5, dica: 'Maior lado da arte (sem a borda).' });
    this.rotArte = deslizante(sa, 'Rotação da arte', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.borda = d(sa, 'Largura da borda', 2.4, { min: 0.8, max: 6, passo: 0.1 });
    this.relevo = d(sa, 'Relevo da arte', 0.7, { min: 0.2, max: 3, passo: 0.1 });
    this.fecho = d(sa, 'Suavizar contorno', 1, { min: 0, max: 10, passo: 0.5 });

    const sc = secao(raiz, 'Clipe');
    this.escalaClipe = d(sc, 'Tamanho da mola', 100, { min: 70, max: 160, passo: 1, un: '%', dica: 'Escala da mola em W (100% = original, 15 × 22 mm).' });
    this.espBase = d(sc, 'Espessura', 10, { min: 4, max: 20, passo: 0.5, dica: 'Altura do clipe deitado na mesa (largura que aperta o saco).' });
    this.ajusteCabeca = d(sc, 'Ajuste da cabeça', 0, { min: -10, max: 10, passo: 0.5, dica: 'Sobe/desce a cabeça em relação ao bloco.' });
  },
  async formas() {
    const a = this.arte;
    if (!a) throw new Error('Envie a arte (SVG ou PNG): a parte de cima do clipe vem dela.');
    const arte = a.tipo === 'svg' ? svgParaSecao(a.dado, { largura: 60, ignorarBranco: true }) : imagemParaSecao(a.dado, { limiar: this.limiar(), largura: 60 });
    return { arte };
  },
  parametros() {
    const k = ['tamanho', 'rotArte', 'borda', 'relevo', 'fecho', 'escalaClipe', 'espBase', 'ajusteCabeca'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.acabamento = this.acabamento();
    return p;
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutClipeSaco(f, p);
    const b = L.corpo.bounds(), dy = -(b.min[1] + b.max[1]) / 2;   // centraliza na vista
    const c = cs => cs.translate([0, dy]);
    return {
      largura: L.larg + 20, altura: L.alt + 20,
      partes: [{ id: 'corpo', poligonos: poligonosDe(c(L.corpo)) }, { id: 'arte', poligonos: poligonosDe(c(L.arte)) }],
      dica: `Cabeça de ${L.cabecaTam[0].toFixed(1)} × ${L.cabecaTam[1].toFixed(1)} mm.` + (L.fechoUsado > p.fecho ? ` Contorno suavizado em ${L.fechoUsado} mm.` : ''),
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const r = geoClipeSaco(f, p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Clipe de saco ${r.L.larg.toFixed(1)} × ${r.L.alt.toFixed(1)} × ${r.alturaTotal.toFixed(1)} mm, cabeça de ${r.L.cabecaTam[0].toFixed(1)} × ${r.L.cabecaTam[1].toFixed(1)} mm, mola a ${p.escalaClipe}%.`,
    };
  },
});
