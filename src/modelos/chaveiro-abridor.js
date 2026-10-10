import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoChaveiroAbridor, layoutChaveiroLogo, rasgoAbridor } from './geo.js';
import { deslizante, numero, arquivo, escolha, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'chaveiro-abridor', exemplo: ['arte'], nome: 'Chaveiro Abridor de Latinha (forma da arte)',
  descricao: 'Chaveiro grosso no formato da sua arte (SVG ou PNG) com um rasgo em cunha na borda pra levantar o anel da latinha. Borda, argola e arte em outra cor.',
  partes: [
    { id: 'base', nome: 'Corpo', cor: 0x34393e },
    { id: 'arte', nome: 'Arte', cor: 0x1c1c1c },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    const mini = el('img', { class: 'miniatura', alt: 'Arte' }); mini.hidden = true;
    const campoArq = arquivo(s, 'Logo (SVG ou PNG)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      if (/\.svg$/i.test(f.name)) this.arte = { tipo: 'svg', dado: await f.text() };
      else this.arte = { tipo: 'img', dado: await lerImagem(f, 900) };
      mini.src = URL.createObjectURL(f); mini.hidden = false; btnLimpar.hidden = false; mudou();
    }, { dica: 'O contorno do logo vira o formato do chaveiro. Partes brancas do SVG são ignoradas.' });
    const btnLimpar = el('button', { class: 'btn-mini', type: 'button', text: 'Remover logo' }); btnLimpar.hidden = true;
    btnLimpar.addEventListener('click', () => { this.arte = null; mini.hidden = true; mini.src = ''; btnLimpar.hidden = true; try { campoArq.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btnLimpar);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Em relevo'], ['rente', 'Rente à base']], 'relevo');
    aoMudar([this.limiar, this.acabamento], mudou);
    texto(s, 'Os vãos dentro do logo (olhos, recortes) aparecem na cor da base.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sc = secao(raiz, 'Chaveiro');
    this.tamanho = d(sc, 'Tamanho do logo', 50, { min: 15, max: 120, passo: 0.5, dica: 'Maior lado do logo (sem a borda).' });
    this.rotArte = deslizante(sc, 'Rotação do logo', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.borda = d(sc, 'Largura da borda', 2.4, { min: 0.8, max: 8, passo: 0.1 });
    this.espBase = d(sc, 'Espessura do corpo', 8, { min: 6, max: 14, passo: 0.1, dica: 'O rasgo do abridor fica dentro dessa espessura.' });
    this.relevo = d(sc, 'Relevo do logo', 0.6, { min: 0.4, max: 4, passo: 0.1, dica: 'No acabamento "rente", é a profundidade do encaixe.' });
    this.fecho = d(sc, 'Suavizar contorno', 1, { min: 0, max: 12, passo: 0.5, dica: 'Junta partes soltas do logo e alisa reentrâncias pequenas.' });
    this.chanfro = d(sc, 'Chanfro embaixo', 0.3, { min: 0, max: 0.8, passo: 0.1 });

    const sr = secao(raiz, 'Abridor (rasgo na borda)');
    this.anguloRasgo = deslizante(sr, 'Lado do rasgo', 325, { min: 0, max: 360, passo: 5, un: '°', aoMudar: mudou, dica: 'Pra onde a boca do rasgo abre. 270° = embaixo, 0° = direita.' });
    this.deslocRasgo = d(sr, 'Deslocar ao longo da borda', 0, { min: -60, max: 60, passo: 0.5 });
    this.larguraRasgo = d(sr, 'Largura do rasgo', 17, { min: 8, max: 30, passo: 0.5 });
    this.profRasgo = d(sr, 'Profundidade do rasgo', 24, { min: 8, max: 40, passo: 0.5, dica: 'Quanto ele entra na peça.' });
    this.zBoca = d(sr, 'Piso na boca', 1, { min: 0.6, max: 4, passo: 0.1, dica: 'Altura do piso na entrada (rampa mais baixa).' });
    this.zFundoRasgo = d(sr, 'Piso no fundo', 2.2, { min: 0.6, max: 6, passo: 0.1, dica: 'O piso sobe em rampa até aqui.' });
    this.zTeto = d(sr, 'Teto do rasgo', 5.6, { min: 2.5, max: 12, passo: 0.1, dica: 'Abaixo do teto fica o vão; acima, o "lábio" que levanta o anel.' });

    const sg = secao(raiz, 'Argola');
    this.anguloArgola = deslizante(sg, 'Lado da argola', 90, { min: 0, max: 360, passo: 5, un: '°', aoMudar: mudou, dica: '90° = em cima, 180° = esquerda, 0° = direita, 270° = embaixo.' });
    this.deslocArgola = d(sg, 'Deslocar ao longo da borda', 0, { min: -60, max: 60, passo: 0.5, dica: '0 = bem no meio do lado escolhido. Arraste pra levar a argola pra um canto.' });
    this.concordancia = d(sg, 'Concordância (arredondar junção)', 1.5, { min: 0, max: 5, passo: 0.25 });
    this.furo = d(sg, 'Diâmetro do furo', 4, { min: 2, max: 10, passo: 0.25 });
    this.paredeArgola = d(sg, 'Parede da argola', 2.5, { min: 1.2, max: 5, passo: 0.1 });
    this.sobreposicao = d(sg, 'Encaixe no contorno', 2.5, { min: 0, max: 8, passo: 0.25, dica: 'Quanto a argola entra no contorno (mais = mais firme).' });
  },
  async arteCs() {
    if (!this.arte) return null;
    return this.arte.tipo === 'svg'
      ? svgParaSecao(this.arte.dado, { largura: 50, ignorarBranco: true })
      : imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 50 });
  },
  async formas() {
    const arte = await this.arteCs();
    if (!arte) throw new Error('Envie o logo (SVG ou PNG): o formato do chaveiro vem dele.');
    return { arte };
  },
  parametros() {
    const k = ['tamanho', 'rotArte', 'borda', 'espBase', 'relevo', 'fecho', 'chanfro', 'anguloArgola', 'deslocArgola', 'concordancia', 'furo', 'paredeArgola', 'sobreposicao',
      'anguloRasgo', 'deslocRasgo', 'larguraRasgo', 'profRasgo', 'zBoca', 'zFundoRasgo', 'zTeto'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.acabamento = this.acabamento();
    return p;
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutChaveiroLogo(f, p);
    const R = rasgoAbridor(L.base, p);
    const esc = (c, k) => [16, 8, 0].reduce((n, s) => n | (Math.round(((c >> s) & 255) * k) << s), 0);
    this.cores.rasgo = esc(this.cores.base, 0.55);
    return {
      largura: L.larg + 20, altura: L.alt + 20,
      partes: [
        { id: 'base', poligonos: poligonosDe(L.base) },
        { id: 'rasgo', poligonos: poligonosDe(R.pegada.intersect(L.base)) },
        { id: 'arte', poligonos: poligonosDe(L.arte) },
      ],
      dica: 'A área escura marca o rasgo do abridor (por dentro da peça, embaixo da arte).'
        + (R.atravessa ? ' ⚠ O rasgo está atravessando a peça: diminua a profundidade ou mude o lado.' : '')
        + (L.fechoUsado > p.fecho ? ` Contorno suavizado em ${L.fechoUsado} mm pra virar uma peça só.` : ''),
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoChaveiroAbridor(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Chaveiro abridor ${r.larg.toFixed(0)} × ${r.alt.toFixed(0)} × ${r.alturaTotal.toFixed(1)} mm, rasgo de ${this.larguraRasgo().toFixed(0)} × ${this.profRasgo().toFixed(0)} mm (vão de ${this.zBoca().toFixed(1)} a ${this.zTeto().toFixed(1)} mm). Imprime deitado, sem suporte.`
        + (r.R.atravessa ? ' ⚠ O rasgo atravessa a peça.' : ''),
    };
  },
});
