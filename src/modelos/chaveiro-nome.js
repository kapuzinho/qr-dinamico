import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoChaveiroNome, layoutChaveiroNome } from './geo.js';
import { deslizante, numero, arquivo, escolha, campoTexto, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'chaveiro-nome', nome: 'Chaveiro de Nome',
  descricao: 'Digite o nome: a base segue o contorno das letras e ganha uma argola na ponta. Dá pra juntar um SVG ou PNG ao lado do nome.',
  partes: [
    { id: 'base', nome: 'Base (contorno)', cor: 0x2f3437 },
    { id: 'texto', nome: 'Nome', cor: 0x35d6c8 },
    { id: 'arte', nome: 'Arte', cor: 0x35d6c8 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    this.nomeTxt = campoTexto(s, 'Nome', 'Seu nome');
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
    aoMudar([this.nomeTxt, this.limiar, this.ladoArte, this.ladoArgola, this.acabamento], mudou);
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
  async formas() {
    const nome = (this.nomeTxt() || '').trim();
    if (!nome) throw new Error('Digite o nome.');
    const fonte = await obterFonte(this.fonte());
    return { texto: textoParaSecao(fonte, nome, { altura: 10 }), arte: await this.arteCs() };
  },
  parametros() {
    const k = ['alturaTexto', 'engrossar', 'relevo', 'borda', 'espBase', 'fecho', 'chanfro', 'furo', 'paredeArgola', 'sobreposicao', 'argolaY',
      'tamArte', 'espacoArte', 'arteY'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.ladoArte = this.ladoArte(); p.ladoArgola = this.ladoArgola(); p.acabamento = this.acabamento();
    return p;
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutChaveiroNome(f, p);
    const partes = [{ id: 'base', poligonos: poligonosDe(L.base) }, { id: 'texto', poligonos: poligonosDe(L.texto) }];
    if (L.arte) partes.push({ id: 'arte', poligonos: poligonosDe(L.arte) });
    return {
      largura: L.larg + 20, altura: L.alt + 20, partes,
      dica: 'Clique numa peça pra trocar a cor.' + (L.fechoUsado > p.fecho ? ` Contorno suavizado em ${L.fechoUsado} mm pra juntar tudo numa peça só.` : ''),
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoChaveiroNome(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Chaveiro ${r.larg.toFixed(0)} × ${r.alt.toFixed(0)} × ${r.alturaTotal.toFixed(1)} mm.`,
    };
  },
});
