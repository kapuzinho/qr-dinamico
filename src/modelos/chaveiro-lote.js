import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoChaveiroNome, layoutChaveiroNome } from './geo.js';
import { deslizante, numero, arquivo, escolha, areaTexto, el, texto, aoMudar, secao } from '../core/ui.js';
import { M } from '../core/motor.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'chaveiro-lote', nome: 'Lembrancinhas em Lote (chaveiros de nome)',
  descricao: 'Cole a lista de nomes (um por linha) e saem todos os chaveiros de uma vez, arrumados na mesa. Ideal pra lembrancinha de festa, escola e evento.',
  partes: [
    { id: 'base', nome: 'Base (contorno)', cor: 0x2f3437 },
    { id: 'texto', nome: 'Nome', cor: 0x35d6c8 },
    { id: 'arte', nome: 'Arte', cor: 0x35d6c8 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    this.nomesTxt = areaTexto(s, 'Nomes (um por linha)', 'Ana\nBruno\nCarla\nDavi\nEla\nFelipe', { linhas: 8, dica: 'Cada linha vira um chaveiro. Linhas vazias são ignoradas.' });
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Lobster-Regular.ttf', { aoMudar: mudou, dica: 'Fontes cursivas grossas (Lobster, Pacifico, Kaushan) ficam melhores.' });
    const mini = el('img', { class: 'miniatura', alt: 'Arte' }); mini.hidden = true;
    const campoArq = arquivo(s, 'Arte ao lado (SVG ou PNG, opcional)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      if (/\.svg$/i.test(f.name)) this.arte = { tipo: 'svg', dado: await f.text() };
      else this.arte = { tipo: 'img', dado: await lerImagem(f, 800) };
      mini.src = URL.createObjectURL(f); mini.hidden = false; btnLimpar.hidden = false; mudou();
    }, { dica: 'Um coração, uma pata, um logo... entra no contorno junto com o nome.' });
    const btnLimpar = el('button', { class: 'btn-mini', type: 'button', text: 'Remover arte' }); btnLimpar.hidden = true;
    btnLimpar.addEventListener('click', () => { this.arte = null; mini.hidden = true; mini.src = ''; btnLimpar.hidden = true; try { campoArq.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btnLimpar);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.ladoArte = escolha(s, 'Lado da arte', [['direita', 'Depois do nome'], ['esquerda', 'Antes do nome']], 'direita');
    this.ladoArgola = escolha(s, 'Argola', [['esquerda', 'No começo (esquerda)'], ['direita', 'No fim (direita)']], 'esquerda');
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Em relevo'], ['rente', 'Rente à base']], 'relevo');
    aoMudar([this.nomesTxt, this.limiar, this.ladoArte, this.ladoArgola, this.acabamento], mudou);
    texto(s, 'A base junta as letras sozinha numa peça só.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const st = secao(raiz, 'Nome');
    this.alturaTexto = d(st, 'Altura do texto', 20, { min: 6, max: 80, passo: 0.5 });
    this.engrossar = d(st, 'Engrossar letras', 0, { min: 0, max: 1.5, passo: 0.05, dica: 'Ajuda fontes finas a imprimirem bem.' });
    this.relevo = d(st, 'Relevo do nome', 1.2, { min: 0.4, max: 4, passo: 0.1, dica: 'No acabamento "rente", é a profundidade do encaixe.' });

    const sb = secao(raiz, 'Base');
    this.borda = d(sb, 'Largura da borda', 2.5, { min: 0.8, max: 8, passo: 0.1 });
    this.espBase = d(sb, 'Espessura da base', 2.4, { min: 1.2, max: 6, passo: 0.1 });
    this.fecho = d(sb, 'Suavizar contorno', 1, { min: 0, max: 10, passo: 0.5, dica: 'Preenche os vãos entre letras e alisa o contorno.' });
    this.chanfro = d(sb, 'Chanfro embaixo', 0.3, { min: 0, max: 0.8, passo: 0.1 });

    const sm = secao(raiz, 'Arranjo na mesa');
    this.mesaX = d(sm, 'Largura útil da mesa', 240, { min: 100, max: 400, passo: 5, dica: 'A1: 256 mm (deixe uma margem).' });
    this.mesaY = d(sm, 'Profundidade útil da mesa', 240, { min: 100, max: 400, passo: 5 });
    this.espacoPecas = d(sm, 'Espaço entre chaveiros', 4, { min: 1, max: 20, passo: 0.5 });

    const sg = secao(raiz, 'Argola');
    this.furo = d(sg, 'Diâmetro do furo', 4, { min: 2, max: 10, passo: 0.25 });
    this.paredeArgola = d(sg, 'Parede da argola', 2.5, { min: 1.2, max: 5, passo: 0.1 });
    this.sobreposicao = d(sg, 'Encaixe no contorno', 3, { min: 0, max: 8, passo: 0.25, dica: 'Quanto a argola entra no contorno (mais = mais firme).' });
    this.argolaY = d(sg, 'Ajuste vertical', 0, { min: -30, max: 30, passo: 0.5 });

    const sa = secao(raiz, 'Arte');
    this.tamArte = d(sa, 'Tamanho da arte', 18, { min: 4, max: 80, passo: 0.5 });
    this.espacoArte = d(sa, 'Distância do nome', 2, { min: -10, max: 20, passo: 0.5 });
    this.arteY = d(sa, 'Ajuste vertical', 0, { min: -30, max: 30, passo: 0.5 });
  },
  async arteCs() {
    if (!this.arte) return null;
    return this.arte.tipo === 'svg'
      ? svgParaSecao(this.arte.dado, { largura: 30, ignorarBranco: true })
      : imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 30 });
  },
  nomes() { return (this.nomesTxt() || '').split('\n').map(n => n.trim()).filter(Boolean).slice(0, 120); },
  async formas() {
    const nomes = this.nomes();
    if (!nomes.length) throw new Error('Digite pelo menos um nome (um por linha).');
    const fonte = await obterFonte(this.fonte()), arte = await this.arteCs();
    return nomes.map(n => ({ nome: n, texto: textoParaSecao(fonte, n, { altura: 10 }), arte }));
  },
  // arruma em fileiras (do maior pro menor), sem passar da mesa
  arrumar(caixas, p) {
    const ordem = caixas.map((c, i) => ({ ...c, i })).sort((a, b) => b.h - a.h);
    const pos = Array(caixas.length), e = p.espacoPecas;
    let x = 0, y = 0, alturaLinha = 0, cabe = 0;
    for (const c of ordem) {
      if (x > 0 && x + c.w > p.mesaX) { x = 0; y += alturaLinha + e; alturaLinha = 0; }
      if (y + c.h > p.mesaY) { pos[c.i] = null; continue; }
      pos[c.i] = [x + c.w / 2, -(y + c.h / 2)];
      x += c.w + e; alturaLinha = Math.max(alturaLinha, c.h); cabe++;
    }
    return { pos, cabe };
  },
  parametros() {
    const k = ['mesaX', 'mesaY', 'espacoPecas', 'alturaTexto', 'engrossar', 'relevo', 'borda', 'espBase', 'fecho', 'chanfro', 'furo', 'paredeArgola', 'sobreposicao', 'argolaY',
      'tamArte', 'espacoArte', 'arteY'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.ladoArte = this.ladoArte(); p.ladoArgola = this.ladoArgola(); p.acabamento = this.acabamento();
    return p;
  },
  async montarLote(p, comGeo) {
    const lista = await this.formas();
    const itens = lista.map(f => {
      const L = layoutChaveiroNome(f, p);
      const b = L.base.bounds();
      return { nome: f.nome, f, L, w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], c: [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2] };
    });
    const { pos, cabe } = this.arrumar(itens, p);
    const fora = itens.filter((_, i) => !pos[i]).map(it => it.nome);
    return { itens, pos, cabe, fora };
  },
  async compor2D(ctx) {
    const p = this.parametros();
    const { itens, pos, cabe, fora } = await this.montarLote(p);
    const C = M().CrossSection, por = { base: [], texto: [], arte: [] };
    itens.forEach((it, i) => {
      if (!pos[i]) return;
      const t = cs => cs.translate([pos[i][0] - it.c[0], pos[i][1] - it.c[1]]);
      por.base.push(t(it.L.base)); por.texto.push(t(it.L.texto)); if (it.L.arte) por.arte.push(t(it.L.arte));
    });
    const juntar = l => l.length ? C.compose(l) : null;
    const base = juntar(por.base), bb = base.bounds(), dx = -(bb.min[0] + bb.max[0]) / 2, dy = -(bb.min[1] + bb.max[1]) / 2;
    const mover = cs => cs && cs.translate([dx, dy]);
    const partes = [{ id: 'base', poligonos: poligonosDe(mover(base)) }, { id: 'texto', poligonos: poligonosDe(mover(juntar(por.texto))) }];
    if (por.arte.length) partes.push({ id: 'arte', poligonos: poligonosDe(mover(juntar(por.arte))) });
    return {
      largura: bb.max[0] - bb.min[0] + 20, altura: bb.max[1] - bb.min[1] + 20, partes,
      dica: `${cabe} chaveiro(s) na mesa.` + (fora.length ? ` ⚠ Não couberam ${fora.length}: ${fora.slice(0, 8).join(', ')}${fora.length > 8 ? '…' : ''} — diminua a altura do texto ou gere em duas vezes.` : ''),
    };
  },
  async gerar(ctx) {
    const p = this.parametros();
    const { itens, pos, cabe, fora } = await this.montarLote(p);
    const Man = M().Manifold, por = { base: [], texto: [], arte: [] };
    itens.forEach((it, i) => {
      if (!pos[i]) return;
      const r = geoChaveiroNome(it.f, p);
      for (const [id, m] of r.partes) por[id]?.push(m.translate([pos[i][0] - it.c[0], pos[i][1] - it.c[1], 0]));
    });
    const partes = Object.entries(por).filter(([, l]) => l.length).map(([id, l]) => [id, Man.compose(l)]);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes,
      montado: partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `${cabe} chaveiro(s) arrumados na mesa (${p.mesaX} × ${p.mesaY} mm).`
        + (fora.length ? ` ⚠ Ficaram de fora: ${fora.join(', ')}.` : ' Todos couberam.'),
    };
  },
});
