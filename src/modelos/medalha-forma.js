import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoMedalhaForma, layoutMedalhaForma } from './geo.js';
import { deslizante, numero, arquivo, escolha, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'medalha-forma', exemplo: ['arte'], nome: 'Medalha Personalizada (forma da arte)',
  descricao: 'A medalha pega o formato da sua arte: envie um SVG ou PNG e o contorno vira a medalha, com borda em volta e alça pra fita em cima. A arte sai em outra cor, em relevo ou rente à base.',
  partes: [
    { id: 'medalha', nome: 'Base / borda', cor: 0xe2bf5f },
    { id: 'arte', nome: 'Arte', cor: 0x1f2120 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    const mini = el('img', { class: 'miniatura', alt: 'Arte' }); mini.hidden = true;
    const campoArq = arquivo(s, 'Arte (SVG ou PNG)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      if (/\.svg$/i.test(f.name)) this.arte = { tipo: 'svg', dado: await f.text() };
      else this.arte = { tipo: 'img', dado: await lerImagem(f, 900) };
      mini.src = URL.createObjectURL(f); mini.hidden = false; btnLimpar.hidden = false; mudou();
    }, { dica: 'O contorno da arte vira o formato da medalha. Partes brancas do SVG são ignoradas.' });
    const btnLimpar = el('button', { class: 'btn-mini', type: 'button', text: 'Remover arte' }); btnLimpar.hidden = true;
    btnLimpar.addEventListener('click', () => { this.arte = null; mini.hidden = true; mini.src = ''; btnLimpar.hidden = true; try { campoArq.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btnLimpar);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Em relevo'], ['rente', 'Rente à base']], 'relevo',
      { dica: 'Em relevo: a arte sobe acima da base. Rente: a arte fica embutida, no mesmo nível.' });
    aoMudar([this.limiar, this.acabamento], mudou);
    texto(s, 'Os vãos dentro da arte (olhos, recortes) aparecem na cor da base.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sm = secao(raiz, 'Medalha');
    this.larguraArte = d(sm, 'Largura da arte', 75, { min: 20, max: 200, passo: 0.5 });
    this.borda = d(sm, 'Largura da borda', 4, { min: 1, max: 15, passo: 0.5 });
    this.espBase = d(sm, 'Espessura da base', 4.8, { min: 2, max: 10, passo: 0.1 });
    this.relevo = d(sm, 'Relevo da arte', 1.2, { min: 0.4, max: 4, passo: 0.1, dica: 'No acabamento "rente", é a profundidade do encaixe.' });
    this.fecho = d(sm, 'Suavizar contorno', 1.5, { min: 0, max: 15, passo: 0.5, dica: 'Junta pedaços próximos da arte e alisa reentrâncias pequenas do contorno.' });
    this.chanfro = d(sm, 'Chanfro embaixo', 0.5, { min: 0, max: 1, passo: 0.1 });

    const sf = secao(raiz, 'Alça da fita');
    this.larguraFita = d(sf, 'Largura da fita', 20, { min: 8, max: 40, passo: 0.5, dica: 'Largura do rasgo (fita + 1 a 2 mm).' });
    this.alturaFita = d(sf, 'Altura do rasgo', 4, { min: 2, max: 10, passo: 0.5 });
    this.paredeAlca = d(sf, 'Parede da alça', 2.2, { min: 1.2, max: 5, passo: 0.1 });
    this.espAlca = d(sf, 'Espessura da alça', 3, { min: 1.6, max: 10, passo: 0.1 });
    this.pescoco = d(sf, 'Altura do pescoço', 6, { min: 0, max: 30, passo: 0.5, dica: 'Distância entre o topo da arte e a argola.' });
  },
  async arteCs() {
    if (!this.arte) return null;
    return this.arte.tipo === 'svg'
      ? svgParaSecao(this.arte.dado, { largura: 60, ignorarBranco: true })
      : imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 60 });
  },
  async formas() {
    const arte = await this.arteCs();
    if (!arte) throw new Error('Envie uma arte (SVG ou PNG): o formato da medalha vem dela.');
    return { arte };
  },
  parametros() {
    const k = ['larguraArte', 'borda', 'espBase', 'relevo', 'fecho', 'chanfro', 'larguraFita', 'alturaFita', 'paredeAlca', 'espAlca', 'pescoco'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.acabamento = this.acabamento();
    return p;
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutMedalhaForma(f, p);
    return {
      largura: L.larg + 20, altura: L.alt + 30,
      partes: [{ id: 'medalha', poligonos: poligonosDe(L.contorno) }, { id: 'arte', poligonos: poligonosDe(L.arte) }],
      dica: 'Clique numa peça pra trocar a cor.' + (L.fechoUsado > p.fecho ? ` A arte tinha partes soltas: o contorno foi suavizado em ${L.fechoUsado} mm pra virar uma peça só.` : ''),
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoMedalhaForma(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Medalha ${r.larg.toFixed(0)} × ${r.alt.toFixed(0)} × ${r.alturaTotal.toFixed(1)} mm, arte ${this.acabamento() === 'rente' ? 'rente à base' : 'em relevo'}.`,
    };
  },
});
