import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoPlacaSinal, layoutPlacaSinal } from './geo.js';
import { deslizante, numero, arquivo, areaTexto, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'placa-sinalizacao', exemplo: ['arte'], nome: 'Placa de Sinalização',
  descricao: 'Placa de porta/sinalização: painel colorido à esquerda (liso ou com a sua arte vazada) e texto editável à direita. Cantos arredondados ajustáveis.',
  partes: [
    { id: 'placa', nome: 'Placa-base', cor: 0xffffff },
    { id: 'painel', nome: 'Painel', cor: 0xd4a92a },
    { id: 'texto', nome: 'Texto', cor: 0xd4a92a },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    this.texto = areaTexto(s, 'Texto da placa', 'Clique aqui para editar', { dica: 'Enter quebra a linha.', linhas: 2 });
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Lobster-Regular.ttf', { aoMudar: mudou });
    const mini = el('img', { class: 'miniatura', alt: 'Arte' }); mini.hidden = true;
    const campoArq = arquivo(s, 'Arte do painel (SVG ou PNG, opcional)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      if (/\.svg$/i.test(f.name)) this.arte = { tipo: 'svg', dado: await f.text() };
      else this.arte = { tipo: 'img', dado: await lerImagem(f, 800) };
      mini.src = URL.createObjectURL(f); mini.hidden = false; btnLimpar.hidden = false; mudou();
    }, { dica: 'A arte é vazada no painel (recorte negativo): aparece a cor da placa-base por baixo.' });
    const btnLimpar = el('button', { class: 'btn-mini', type: 'button', text: 'Remover arte' }); btnLimpar.hidden = true;
    btnLimpar.addEventListener('click', () => { this.arte = null; mini.hidden = true; mini.src = ''; btnLimpar.hidden = true; try { campoArq.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btnLimpar);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    aoMudar([this.texto, this.limiar], mudou);
    texto(s, 'No 2D dá pra arrastar o texto e a arte. Sem arte, o painel sai liso.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sp = secao(raiz, 'Placa');
    this.largura = d(sp, 'Largura', 177, { min: 80, max: 250 });
    this.altura = d(sp, 'Altura', 68.5, { min: 30, max: 150 });
    this.rInfEsq = d(sp, 'Canto inferior esquerdo', 34, { min: 0, max: 75, dica: 'Raio do canto arredondado de baixo, à esquerda.' });
    this.rSupDir = d(sp, 'Canto superior direito', 41, { min: 0, max: 75, dica: 'Raio do canto arredondado de cima, à direita.' });
    this.rReto = d(sp, 'Outros cantos', 0, { min: 0, max: 15, dica: '0 = canto vivo.' });
    this.espBase = d(sp, 'Espessura da placa', 3.3, { min: 1.6, max: 6, passo: 0.1 });

    const sn = secao(raiz, 'Painel');
    this.larguraPainel = d(sn, 'Largura do painel', 54, { min: 20, max: 120 });
    this.margem = d(sn, 'Margem (borda branca)', 3.4, { min: 1, max: 10, passo: 0.1 });
    this.relevoPainel = d(sn, 'Relevo do painel', 1.7, { min: 0.4, max: 4, passo: 0.1 });
    this.afundar = d(sn, 'Painel afundado na placa', 0.3, { min: 0, max: 1.5, passo: 0.1, dica: 'Encaixe da cor dentro da placa-base.' });

    const sa = secao(raiz, 'Arte (vazada no painel)');
    this.larguraArte = d(sa, 'Largura da arte', 32, { min: 5, max: 110 });
    this.arteX = d(sa, 'Posição horizontal', 0, { min: -50, max: 50, dica: '0 = centro do painel.' });
    this.arteY = d(sa, 'Posição vertical', 0, { min: -50, max: 50 });
    this.rotArte = deslizante(sa, 'Rotação', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });

    const st = secao(raiz, 'Texto');
    this.altTexto = d(st, 'Altura máx. do texto', 16, { min: 4, max: 60, dica: 'Diminui sozinho se não couber na largura.' });
    this.relevoTexto = d(st, 'Relevo do texto', 0.8, { min: 0.4, max: 3, passo: 0.1 });
    this.espacoTexto = d(st, 'Distância do painel', 4, { min: 0, max: 20 });
    this.textoX = d(st, 'Ajuste horizontal', 0, { min: -60, max: 60 });
    this.textoY = d(st, 'Ajuste vertical', 0, { min: -40, max: 40 });
  },
  async arteCs() {
    if (!this.arte) return null;
    return this.arte.tipo === 'svg'
      ? svgParaSecao(this.arte.dado, { largura: 40, ignorarBranco: true })
      : imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 40 });
  },
  async formas() {
    const fonte = await obterFonte(this.fonte());
    const t = (this.texto() || '').trim();
    return { texto: t ? textoParaSecao(fonte, t, { altura: 10 }) : null, arte: await this.arteCs() };
  },
  parametros() {
    const k = ['largura', 'altura', 'rInfEsq', 'rSupDir', 'rReto', 'espBase', 'larguraPainel', 'margem', 'relevoPainel', 'afundar',
      'larguraArte', 'arteX', 'arteY', 'rotArte', 'altTexto', 'relevoTexto', 'espacoTexto', 'textoX', 'textoY'];
    return Object.fromEntries(k.map(n => [n, this[n]()]));
  },
  // arrastar no 2D: atualiza os sliders (que já redesenham)
  arrastar(id, dx, dy) {
    const mover = (sx, sy) => { sx.definir(+(sx() + dx).toFixed(1)); sy.definir(+(sy() + dy).toFixed(1)); };
    if (id === 'arte') mover(this.arteX, this.arteY);
    if (id === 'texto') mover(this.textoX, this.textoY);
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutPlacaSinal(f, p);
    this.cores.arte = this.cores.placa; // a arte vazada mostra a cor da placa-base
    const partes = [
      { id: 'placa', poligonos: poligonosDe(L.placa) },
      { id: 'painel', poligonos: poligonosDe(L.painel) },
    ];
    if (L.arte) partes.push({ id: 'arte', movel: true, poligonos: poligonosDe(L.arte) });
    if (L.texto) partes.push({ id: 'texto', movel: true, poligonos: poligonosDe(L.texto) });
    return {
      largura: p.largura + 20, altura: p.altura + 20, partes,
      dica: 'Arraste o texto ou a arte pra posicionar. Clique numa peça pra trocar a cor.',
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoPlacaSinal(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Placa de sinalização ${this.largura().toFixed(0)} × ${this.altura().toFixed(1)} × ${r.espTotal.toFixed(1)} mm. `
        + (this.arte ? 'Arte vazada no painel.' : 'Painel liso.'),
    };
  },
});
