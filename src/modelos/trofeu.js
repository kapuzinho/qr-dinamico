import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoTrofeu, layoutTrofeu, retArred } from './geo.js';
import { deslizante, numero, arquivo, escolha, campoTexto, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'trofeu', exemplo: ['arte'], nome: 'Troféu',
  descricao: 'Troféu com disco pra arte, três hastes e base com duas linhas de texto. O disco + hastes é uma peça chapada (imprime deitada, com a arte pra cima) que encaixa no rasgo da base.',
  partes: [
    { id: 'base', nome: 'Base', cor: 0x2a2d31 },
    { id: 'pedestal', nome: 'Pedestal (disco da base)', cor: 0xe2bf5f },
    { id: 'texto', nome: 'Texto da base', cor: 0xe2bf5f },
    { id: 'figura', nome: 'Disco + hastes', cor: 0xe2bf5f },
    { id: 'arte', nome: 'Arte do disco', cor: 0x2a2d31 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    this.linha1 = campoTexto(s, 'Texto da base (linha 1)', 'Clique aqui para editar');
    this.linha2 = campoTexto(s, 'Texto da base (linha 2)', 'Clique aqui para editar', { dica: 'Deixe vazio pra ter só uma linha.' });
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Lobster-Regular.ttf', { aoMudar: mudou });
    const mini = el('img', { class: 'miniatura', alt: 'Arte' }); mini.hidden = true;
    const campoArq = arquivo(s, 'Arte do disco (SVG ou PNG)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      if (/\.svg$/i.test(f.name)) this.arte = { tipo: 'svg', dado: await f.text() };
      else this.arte = { tipo: 'img', dado: await lerImagem(f, 800) };
      mini.src = URL.createObjectURL(f); mini.hidden = false; btnLimpar.hidden = false; mudou();
    }, { dica: 'Fica centralizada no disco. Sem arte, o disco sai liso.' });
    const btnLimpar = el('button', { class: 'btn-mini', type: 'button', text: 'Remover arte' }); btnLimpar.hidden = true;
    btnLimpar.addEventListener('click', () => { this.arte = null; mini.hidden = true; mini.src = ''; btnLimpar.hidden = true; try { campoArq.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btnLimpar);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.acabamento = escolha(s, 'Acabamento da arte', [['relevo', 'Em relevo'], ['rente', 'Rente ao disco']], 'relevo');
    aoMudar([this.linha1, this.linha2, this.limiar, this.acabamento], mudou);
    texto(s, 'Imprima a base em pé e o disco + hastes deitado. Depois é só encaixar (dá pra colar com uma gota de cola).');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sd = secao(raiz, 'Disco e hastes');
    this.diametroDisco = d(sd, 'Diâmetro do disco', 80, { min: 40, max: 160 });
    this.alturaHastes = d(sd, 'Altura das hastes', 75, { min: 30, max: 160, dica: 'Do pedestal até a parte de baixo do disco.' });
    this.larguraHaste = d(sd, 'Largura de cada haste', 7, { min: 4, max: 20, passo: 0.5 });
    this.espacoHastes = d(sd, 'Espaço entre as hastes', 4, { min: 1, max: 20, passo: 0.5 });
    this.aberturaPontas = d(sd, 'Abertura das pontas', 6, { min: -20, max: 30, passo: 0.5, dica: 'Quanto as hastes laterais passam pra fora do disco.' });
    this.alturaPontas = deslizante(sd, 'Altura das pontas', 0.3, { min: 0, max: 0.9, passo: 0.05, aoMudar: mudou, dica: 'Onde as pontas terminam, em fração do raio do disco.' });
    this.espessura = d(sd, 'Espessura da peça', 6, { min: 3, max: 15, passo: 0.5 });

    const sa = secao(raiz, 'Arte do disco');
    this.tamArte = d(sa, 'Tamanho da arte', 55, { min: 10, max: 150 });
    this.relevoArte = d(sa, 'Relevo da arte', 1, { min: 0.4, max: 3, passo: 0.1 });
    this.arteY = d(sa, 'Ajuste vertical', 0, { min: -40, max: 40 });

    const sb = secao(raiz, 'Base');
    this.larguraBase = d(sb, 'Largura', 70, { min: 30, max: 200 });
    this.profBase = d(sb, 'Profundidade', 45, { min: 20, max: 150 });
    this.alturaBase = d(sb, 'Altura', 22, { min: 10, max: 60 });
    this.raioBase = d(sb, 'Cantos', 3, { min: 0, max: 15, passo: 0.5 });
    this.diametroPedestal = d(sb, 'Diâmetro do pedestal', 42, { min: 15, max: 150 });
    this.alturaPedestal = d(sb, 'Altura do pedestal', 2.5, { min: 0.6, max: 10, passo: 0.1 });
    this.profEncaixe = d(sb, 'Profundidade do encaixe', 12, { min: 4, max: 40, passo: 0.5 });
    this.folga = d(sb, 'Folga do encaixe', 0.25, { min: 0.05, max: 0.8, passo: 0.05, dica: 'De cada lado. PETG: 0.25.' });

    const st = secao(raiz, 'Texto da base');
    this.altLinha1 = d(st, 'Altura da linha 1', 5, { min: 2, max: 20, passo: 0.5 });
    this.altLinha2 = d(st, 'Altura da linha 2', 3.5, { min: 2, max: 20, passo: 0.5 });
    this.relevoTexto = d(st, 'Relevo do texto', 0.8, { min: 0.4, max: 3, passo: 0.1 });
    this.margemTexto = d(st, 'Margem lateral', 6, { min: 1, max: 30, passo: 0.5 });
    this.textoY = d(st, 'Ajuste vertical', 0, { min: -20, max: 20, passo: 0.5 });
  },
  async arteCs() {
    if (!this.arte) return null;
    return this.arte.tipo === 'svg'
      ? svgParaSecao(this.arte.dado, { largura: 40, ignorarBranco: true })
      : imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 40 });
  },
  async formas() {
    const fonte = await obterFonte(this.fonte());
    const t = v => (v || '').trim() ? textoParaSecao(fonte, v.trim(), { altura: 10 }) : null;
    return { arte: await this.arteCs(), linha1: t(this.linha1()), linha2: t(this.linha2()) };
  },
  parametros() {
    const k = ['diametroDisco', 'alturaHastes', 'larguraHaste', 'espacoHastes', 'aberturaPontas', 'alturaPontas', 'espessura',
      'tamArte', 'relevoArte', 'arteY', 'larguraBase', 'profBase', 'alturaBase', 'raioBase', 'diametroPedestal', 'alturaPedestal',
      'profEncaixe', 'folga', 'altLinha1', 'altLinha2', 'relevoTexto', 'margemTexto', 'textoY'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.acabamento = this.acabamento();
    p.profEncaixe = Math.min(p.profEncaixe, p.alturaBase + p.alturaPedestal - 3);
    return p;
  },
  // 2D = vista de frente do troféu montado
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutTrofeu(f, p);
    const C = L.figura.constructor;
    const hP = p.alturaPedestal, H = p.alturaBase;
    const base = retArred(p.larguraBase, H, Math.min(p.raioBase, H / 2 - 0.1)).translate([0, -hP - H / 2]);
    const ped = C.square([p.diametroPedestal, hP], false).translate([-p.diametroPedestal / 2, -hP]);
    const figVisivel = L.figura.intersect(C.square([1e4, 1e4], false).translate([-5e3, 0]));
    const partes = [
      { id: 'base', poligonos: poligonosDe(base) },
      { id: 'pedestal', poligonos: poligonosDe(ped) },
      { id: 'figura', poligonos: poligonosDe(figVisivel) },
    ];
    if (L.arte) partes.push({ id: 'arte', poligonos: poligonosDe(L.arte) });
    if (L.texto) partes.push({ id: 'texto', poligonos: poligonosDe(L.texto) });
    const altTotal = H + hP + L.alturaFigura;
    return {
      largura: Math.max(p.larguraBase, L.larguraFigura) + 20, altura: altTotal * 2 + 20,   // centro da vista = topo do pedestal
      partes,
      dica: 'Vista de frente do troféu montado. Clique numa peça pra trocar a cor.',
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const r = geoTrofeu(f, p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.montado,                       // vista 3D: troféu montado
      montado: r.montado.map(([id, m]) => [id, m, [cx, cy, 0]]),
      imprimir: r.partes,                      // downloads (.3mf/.stl): peças deitadas na mesa
      resumo: `Troféu montado com ${r.alturaTotal.toFixed(0)} mm de altura. Base ${p.larguraBase.toFixed(0)} × ${p.profBase.toFixed(0)} × ${p.alturaBase.toFixed(0)} mm (imprime em pé). `
        + `Disco + hastes: peça chapada de ${p.espessura.toFixed(1)} mm (imprime deitada) que encaixa ${p.profEncaixe.toFixed(0)} mm no rasgo.`,
    };
  },
});
