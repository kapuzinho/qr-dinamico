import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoMolle, layoutMolle } from './geo.js';
import { deslizante, numero, arquivo, escolha, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

function campoArte(s, rotulo, dica, aoTrocar) {
  const mini = el('img', { class: 'miniatura', alt: rotulo }); mini.hidden = true;
  const campo = arquivo(s, rotulo, '.svg,.png,.jpg,.jpeg,.webp', async f => {
    const a = /\.svg$/i.test(f.name) ? { tipo: 'svg', dado: await f.text() } : { tipo: 'img', dado: await lerImagem(f, 900) };
    mini.src = URL.createObjectURL(f); mini.hidden = false; btn.hidden = false; aoTrocar(a);
  }, { dica });
  const btn = el('button', { class: 'btn-mini', type: 'button', text: 'Remover' }); btn.hidden = true;
  btn.addEventListener('click', () => { mini.hidden = true; mini.src = ''; btn.hidden = true; try { campo.value = ''; } catch {} aoTrocar(null); });
  s.append(mini); s.append(btn);
}

export default criarEditorModelo({
  id: 'molle-tag', exemplo: ['arte'], nome: 'MOLLE Tag',
  descricao: 'Placa MOLLE com dois rasgos laterais abertos no meio (quatro encaixes) pra prender em mochila/colete. Envie uma arte (SVG ou PNG) pra frente; o corpo e os encaixes não mudam.',
  partes: [
    { id: 'corpo', nome: 'Corpo', cor: 0x263238 },
    { id: 'frente', nome: 'Arte da frente', cor: 0x0d0d0d },
    { id: 'verso', nome: 'Arte do verso', cor: 0x8f9a5b },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null; this.arteVerso = null;
    campoArte(s, 'Arte da frente (SVG ou PNG)', 'Fica centralizada entre os encaixes.', a => { this.arte = a; mudou(); });
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Em relevo'], ['rente', 'Rente ao corpo']], 'relevo');
    this.faces = escolha(s, 'Faces', [['frente', 'Só frente'], ['ambas', 'Frente e verso']], 'frente', { dica: 'No verso a arte fica nivelada (embutida no fundo).' });
    this.origemVerso = escolha(s, 'Arte do verso', [['mesma', 'A mesma da frente'], ['outra', 'Outra arte']], 'mesma');
    campoArte(s, 'Outra arte pro verso (SVG ou PNG)', 'Só vale com "Outra arte".', a => { this.arteVerso = a; mudou(); });
    aoMudar([this.limiar, this.acabamento, this.faces, this.origemVerso], mudou);
    texto(s, 'Sem arte, sai só o corpo com os encaixes. No 2D dá pra arrastar a arte.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sc = secao(raiz, 'Corpo');
    this.largura = d(sc, 'Largura', 118, { min: 60, max: 200, passo: 0.5 });
    this.altura = d(sc, 'Altura', 72, { min: 40, max: 150, passo: 0.5 });
    this.raio = d(sc, 'Cantos', 7, { min: 0, max: 20, passo: 0.5 });
    this.espessura = d(sc, 'Espessura', 4, { min: 2, max: 8, passo: 0.1 });

    const sm = secao(raiz, 'Encaixes MOLLE');
    this.larguraRasgo = d(sm, 'Largura do rasgo', 8, { min: 3, max: 15, passo: 0.25, dica: 'Folga pra fita MOLLE (fita de 25 mm).' });
    this.comprimentoRasgo = d(sm, 'Comprimento do rasgo', 57.6, { min: 20, max: 140, passo: 0.5, dica: 'Precisa ser maior que a largura da fita (25 mm) em cada encaixe.' });
    this.margemRasgo = d(sm, 'Distância da borda (centro do rasgo)', 10, { min: 5, max: 30, passo: 0.25 });
    this.abertura = d(sm, 'Abertura pra borda', 10, { min: 0, max: 30, passo: 0.5, dica: 'Vão no meio do rasgo que divide em 2 encaixes. 0 = rasgo fechado.' });
    this.concordancia = d(sm, 'Arredondar cantos da abertura', 1, { min: 0, max: 3, passo: 0.1 });

    const sa = secao(raiz, 'Arte');
    this.tamArte = d(sa, 'Tamanho da arte', 62, { min: 10, max: 140, passo: 0.5, dica: 'Maior lado. É cortada se passar da área entre os encaixes.' });
    this.relevo = d(sa, 'Relevo da arte', 0.6, { min: 0.2, max: 3, passo: 0.1 });
    this.rotArte = deslizante(sa, 'Rotação', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.arteX = d(sa, 'Ajuste horizontal', 0, { min: -50, max: 50, passo: 0.5 });
    this.arteY = d(sa, 'Ajuste vertical', 0, { min: -40, max: 40, passo: 0.5 });

    const sv = secao(raiz, 'Verso');
    this.profVerso = d(sv, 'Profundidade do verso', 0.6, { min: 0.2, max: 2, passo: 0.1 });
    this.tamVerso = d(sv, 'Tamanho da outra arte', 50, { min: 5, max: 140, passo: 0.5 });
    this.rotVerso = deslizante(sv, 'Rotação da outra arte', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.versoX = d(sv, 'Ajuste horizontal (verso)', 0, { min: -50, max: 50, passo: 0.5 });
    this.versoY = d(sv, 'Ajuste vertical (verso)', 0, { min: -40, max: 40, passo: 0.5 });
  },
  async cs(a) {
    if (!a) return null;
    return a.tipo === 'svg' ? svgParaSecao(a.dado, { largura: 60, ignorarBranco: true }) : imagemParaSecao(a.dado, { limiar: this.limiar(), largura: 60 });
  },
  async formas() {
    const arte = await this.cs(this.arte);
    const verso = this.origemVerso() === 'outra' ? await this.cs(this.arteVerso) : null;
    return { arte, verso: verso || 'mesma' };
  },
  parametros() {
    const k = ['largura', 'altura', 'raio', 'espessura', 'larguraRasgo', 'comprimentoRasgo', 'margemRasgo', 'abertura', 'concordancia',
      'tamArte', 'relevo', 'rotArte', 'arteX', 'arteY', 'profVerso', 'tamVerso', 'rotVerso', 'versoX', 'versoY'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.acabamento = this.acabamento(); p.faces = this.faces();
    p.comprimentoRasgo = Math.min(p.comprimentoRasgo, p.altura - 6);
    return p;
  },
  arrastar(id, dx, dy) {
    if (id !== 'frente') return;
    this.arteX.definir(+(this.arteX() + dx).toFixed(1));
    this.arteY.definir(+(this.arteY() + dy).toFixed(1));
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutMolle(f, p);
    const partes = [{ id: 'corpo', poligonos: poligonosDe(L.corpo) }];
    if (L.arte) partes.push({ id: 'frente', movel: true, poligonos: poligonosDe(L.arte) });
    const encaixe = (p.comprimentoRasgo - p.abertura) / 2;
    return {
      largura: p.largura + 20, altura: p.altura + 20, partes,
      dica: `Cada encaixe tem ${encaixe.toFixed(1)} mm de comprimento útil` + (encaixe < 25.5 ? ' ⚠ menor que a fita MOLLE de 25 mm.' : '.')
        + (L.verso ? ' A arte do verso (embutida no fundo) aparece no 3D.' : ''),
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const r = geoMolle(f, p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `MOLLE tag ${p.largura.toFixed(1)} × ${p.altura.toFixed(1)} × ${r.alturaTotal.toFixed(1)} mm, ${r.partes.length} volume(s), quatro encaixes MOLLE (rasgos de ${p.larguraRasgo} mm).`,
    };
  },
});
