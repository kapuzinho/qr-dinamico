import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoMarcaPagina, layoutMarcaPagina } from './geo.js';
import { deslizante, numero, arquivo, escolha, marcar, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'marca-pagina', exemplo: ['arte'], nome: 'Marca-página (forma da arte)',
  descricao: 'Marca-página com haste longa e presilha em U pra prender na folha. A parte de cima pega o formato da sua arte (SVG ou PNG), em relevo ou nivelada.',
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
    }, { dica: 'O contorno da arte vira a cabeça do marca-página.' });
    const btn = el('button', { class: 'btn-mini', type: 'button', text: 'Remover arte' }); btn.hidden = true;
    btn.addEventListener('click', () => { this.arte = null; mini.hidden = true; mini.src = ''; btn.hidden = true; try { campo.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btn);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Elevada (relevo)'], ['rente', 'Nivelada']], 'relevo');
    aoMudar([this.limiar, this.acabamento], mudou);
    texto(s, 'A presilha em U é uma língua que flexiona e prende a página. Imprima deitado.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sa = secao(raiz, 'Cabeça (arte)');
    this.tamanho = d(sa, 'Largura da arte', 48, { min: 15, max: 120, passo: 0.5, dica: 'Maior lado da arte (sem a borda).' });
    this.rotArte = deslizante(sa, 'Rotação da arte', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.borda = d(sa, 'Largura da borda', 2.4, { min: 0.8, max: 8, passo: 0.1 });
    this.relevo = d(sa, 'Relevo da arte', 0.7, { min: 0.2, max: 3, passo: 0.1 });
    this.fecho = d(sa, 'Suavizar contorno', 1, { min: 0, max: 12, passo: 0.5 });
    this.sobreposicao = d(sa, 'Cabeça sobre a haste', 12, { min: 2, max: 40, passo: 0.5, dica: 'Quanto a cabeça desce sobre a haste (mais = mais firme).' });

    const sh = secao(raiz, 'Haste');
    this.comprimentoHaste = d(sh, 'Comprimento da haste', 132, { min: 40, max: 250, passo: 1 });
    this.larguraHaste = d(sh, 'Largura da haste', 24, { min: 8, max: 60, passo: 0.5 });
    this.raioPonta = d(sh, 'Arredondar a ponta', 8.3, { min: 0, max: 30, passo: 0.1 });
    this.espBase = d(sh, 'Espessura', 1.2, { min: 0.6, max: 4, passo: 0.1, dica: 'Fino o bastante pra presilha flexionar (1,0–1,4 mm).' });

    const sp = secao(raiz, 'Presilha em U');
    this.presilha = marcar(sp, 'Com presilha', true);
    this.presilha.input.addEventListener('change', mudou);
    this.larguraLingua = d(sp, 'Largura da língua', 9, { min: 3, max: 40, passo: 0.5 });
    this.corte = d(sp, 'Largura do corte', 1.5, { min: 0.6, max: 4, passo: 0.1 });
    this.inicioPresilha = d(sp, 'Distância da ponta', 6.5, { min: 2, max: 60, passo: 0.5 });
  },
  async formas() {
    const a = this.arte;
    if (!a) throw new Error('Envie a arte (SVG ou PNG): a parte de cima do marca-página vem dela.');
    const arte = a.tipo === 'svg' ? svgParaSecao(a.dado, { largura: 60, ignorarBranco: true }) : imagemParaSecao(a.dado, { limiar: this.limiar(), largura: 60 });
    return { arte };
  },
  parametros() {
    const k = ['tamanho', 'rotArte', 'borda', 'relevo', 'fecho', 'sobreposicao', 'comprimentoHaste', 'larguraHaste', 'raioPonta', 'espBase',
      'larguraLingua', 'corte', 'inicioPresilha'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.presilha = !!this.presilha(); p.acabamento = this.acabamento();
    p.larguraLingua = Math.min(p.larguraLingua, p.larguraHaste - 2 * p.corte - 3);
    return p;
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutMarcaPagina(f, p);
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
    const r = geoMarcaPagina(f, p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Marca-página ${r.L.larg.toFixed(1)} × ${r.L.alt.toFixed(1)} × ${r.alturaTotal.toFixed(1)} mm, cabeça de ${r.L.cabecaTam[0].toFixed(1)} × ${r.L.cabecaTam[1].toFixed(1)} mm`
        + (p.presilha ? `, presilha em U de ${p.larguraLingua} mm.` : '.'),
    };
  },
});
