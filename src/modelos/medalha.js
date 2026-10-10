import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoMedalha, layoutMedalha } from './geo.js';
import { deslizante, numero, arquivo, escolha, marcar, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'medalha', exemplo: ['arte'], nome: 'Medalha',
  descricao: 'Medalha com aro serrilhado e alça pra fita. Envie a arte (SVG ou PNG) e ela fica centralizada na face da medalha, em relevo, gravada ou embutida em outra cor.',
  partes: [
    { id: 'medalha', nome: 'Medalha', cor: 0xd4a92a },
    { id: 'arte', nome: 'Arte', cor: 0x1a1a1a },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    const mini = el('img', { class: 'miniatura', alt: 'Arte' }); mini.hidden = true;
    const campoArq = arquivo(s, 'Arte do centro (SVG ou PNG)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      if (/\.svg$/i.test(f.name)) this.arte = { tipo: 'svg', dado: await f.text() };
      else this.arte = { tipo: 'img', dado: await lerImagem(f, 800) };
      mini.src = URL.createObjectURL(f); mini.hidden = false; btnLimpar.hidden = false; mudou();
    }, { dica: 'A arte é centralizada sozinha na face da medalha.' });
    const btnLimpar = el('button', { class: 'btn-mini', type: 'button', text: 'Remover arte' }); btnLimpar.hidden = true;
    btnLimpar.addEventListener('click', () => { this.arte = null; mini.hidden = true; mini.src = ''; btnLimpar.hidden = true; try { campoArq.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btnLimpar);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.modoArte = escolha(s, 'Como a arte sai', [
      ['relevo', 'Em relevo (outra cor)'], ['embutido', 'Embutida, nivelada (outra cor)'], ['gravado', 'Gravada (baixo-relevo, 1 cor)'],
    ], 'relevo');
    aoMudar([this.limiar, this.modoArte], mudou);
    texto(s, 'Sem arte, a face central sai lisa. No 2D dá pra arrastar a arte.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sm = secao(raiz, 'Medalha');
    this.diametro = d(sm, 'Diâmetro', 85, { min: 40, max: 150 });
    this.espessura = d(sm, 'Espessura total', 8.4, { min: 3, max: 15, passo: 0.1 });
    this.larguraAro = d(sm, 'Largura do aro', 10, { min: 3, max: 25, passo: 0.5 });
    this.sulco = d(sm, 'Sulco entre aro e centro', 1, { min: 0, max: 4, passo: 0.1 });
    this.chanfro = d(sm, 'Chanfro embaixo', 0.5, { min: 0, max: 1, passo: 0.1, dica: 'Recua a 1ª camada (evita pé-de-elefante).' });

    const ss = secao(raiz, 'Serrilha do aro');
    this.serrilha = marcar(ss, 'Aro serrilhado (raios)', true);
    this.serrilha.input.addEventListener('change', mudou);
    this.nRaios = deslizante(ss, 'Quantidade de raios', 45, { min: 12, max: 120, passo: 1, aoMudar: mudou });
    this.alturaSerrilha = d(ss, 'Altura da serrilha', 1.7, { min: 0.4, max: 4, passo: 0.1, dica: 'Quanto o aro desce entre um raio e outro.' });

    const sf = secao(raiz, 'Alça da fita');
    this.larguraFita = d(sf, 'Largura do rasgo', 19.5, { min: 8, max: 40, passo: 0.5, dica: 'Largura da fita + 1 a 2 mm.' });
    this.alturaFita = d(sf, 'Altura do rasgo', 4, { min: 2, max: 10, passo: 0.5 });
    this.paredeAlca = d(sf, 'Parede da alça', 2, { min: 1.2, max: 5, passo: 0.1 });
    this.espAlca = d(sf, 'Espessura da alça', 5, { min: 2, max: 10, passo: 0.1 });

    const sa = secao(raiz, 'Arte');
    this.tamArte = d(sa, 'Tamanho da arte', 40, { min: 5, max: 120, dica: 'Maior lado da arte. Ela é cortada pra não passar da face central.' });
    this.relevoArte = d(sa, 'Relevo / profundidade', 1, { min: 0.4, max: 4, passo: 0.1 });
    this.arteX = d(sa, 'Ajuste horizontal', 0, { min: -40, max: 40, dica: '0 = centro.' });
    this.arteY = d(sa, 'Ajuste vertical', 0, { min: -40, max: 40 });
    this.rotArte = deslizante(sa, 'Rotação', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
  },
  async arteCs() {
    if (!this.arte) return null;
    return this.arte.tipo === 'svg'
      ? svgParaSecao(this.arte.dado, { largura: 40, ignorarBranco: true })
      : imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 40 });
  },
  async formas() { return { arte: await this.arteCs() }; },
  parametros() {
    const k = ['diametro', 'espessura', 'larguraAro', 'sulco', 'chanfro', 'alturaSerrilha', 'larguraFita', 'alturaFita', 'paredeAlca', 'espAlca',
      'tamArte', 'relevoArte', 'arteX', 'arteY', 'rotArte'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.serrilha = !!this.serrilha();
    p.nRaios = Math.round(this.nRaios());
    p.modoArte = this.modoArte();
    p.alturaSerrilha = Math.min(p.alturaSerrilha, p.espessura - 1.2);
    p.espAlca = Math.min(p.espAlca, p.espessura - p.alturaSerrilha);
    return p;
  },
  arrastar(id, dx, dy) {
    if (id !== 'arte' && id !== 'gravado') return;
    this.arteX.definir(+(this.arteX() + dx).toFixed(1));
    this.arteY.definir(+(this.arteY() + dy).toFixed(1));
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutMedalha(f, p);
    // tons só pra prévia: sulco e arte gravada aparecem um pouco mais escuros que a medalha
    const escurecer = (c, k) => [16, 8, 0].reduce((n, s) => n | (Math.round(((c >> s) & 255) * k) << s), 0);
    this.cores.sulco = escurecer(this.cores.medalha, 0.6);
    this.cores.gravado = escurecer(this.cores.medalha, 0.75);
    const partes = [{ id: 'medalha', poligonos: poligonosDe(L.contorno) }];
    if (p.sulco > 0) partes.push({ id: 'sulco', poligonos: poligonosDe(L.face.offset(p.sulco, 'Round', 2, 64).subtract(L.face)) });
    if (L.arte) partes.push({ id: p.modoArte === 'gravado' ? 'gravado' : 'arte', movel: true, poligonos: poligonosDe(L.arte) });
    return {
      largura: p.diametro + 20, altura: p.diametro + 2 * (p.alturaFita + p.paredeAlca) + 20, partes,
      dica: this.arte ? 'Arraste a arte pra ajustar. Ela já começa centralizada.' : 'Envie uma arte (SVG ou PNG) pra colocar no centro da medalha.',
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoMedalha(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    const modo = { relevo: 'arte em relevo', embutido: 'arte embutida (nivelada)', gravado: 'arte gravada' }[this.modoArte()];
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Medalha Ø ${this.diametro().toFixed(0)} mm, ${r.alturaTotal.toFixed(1)} mm de altura. ` + (this.arte ? `${modo[0].toUpperCase() + modo.slice(1)}.` : 'Face central lisa.'),
    };
  },
});
