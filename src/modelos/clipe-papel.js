import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoClipe, layoutClipe } from './geo.js';
import { deslizante, numero, arquivo, escolha, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'clipe-papel', exemplo: ['arte'], nome: 'Clipe de Papel (forma da arte)',
  descricao: 'Clipe de papel funcional (dois U de fio encaixados) com a parte de cima no formato da sua arte (SVG ou PNG), em relevo ou nivelada.',
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
    texto(s, 'O papel entra entre o U de fora e o de dentro. Imprima deitado; PETG ou PLA flexionam bem nessa espessura.');
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
    this.comprimento = d(sc, 'Comprimento do clipe', 34, { min: 15, max: 80, passo: 0.5 });
    this.larguraClipe = d(sc, 'Largura do clipe', 13.5, { min: 8, max: 30, passo: 0.1 });
    this.larguraFio = d(sc, 'Largura do fio', 1.6, { min: 1, max: 3, passo: 0.1 });
    this.folga = d(sc, 'Folga entre os fios', 0.4, { min: 0.1, max: 1.5, passo: 0.05, dica: 'Vão onde o papel entra (lados). Menor = aperta mais.' });
    this.folgaFundo = d(sc, 'Folga no fundo', 1.4, { min: 0.3, max: 4, passo: 0.1 });
    this.alturaBloco = d(sc, 'Bloco de ligação', 6.2, { min: 2, max: 15, passo: 0.1, dica: 'Bloco que liga os dois U à cabeça.' });
    this.espBase = d(sc, 'Espessura', 1.7, { min: 0.8, max: 4, passo: 0.1 });
  },
  async formas() {
    const a = this.arte;
    if (!a) throw new Error('Envie a arte (SVG ou PNG): a parte de cima do clipe vem dela.');
    const arte = a.tipo === 'svg' ? svgParaSecao(a.dado, { largura: 60, ignorarBranco: true }) : imagemParaSecao(a.dado, { limiar: this.limiar(), largura: 60 });
    return { arte };
  },
  parametros() {
    const k = ['tamanho', 'rotArte', 'borda', 'relevo', 'fecho', 'comprimento', 'larguraClipe', 'larguraFio', 'folga', 'folgaFundo', 'alturaBloco', 'espBase'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.acabamento = this.acabamento();
    return p;
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutClipe(f, p);
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
    const r = geoClipe(f, p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Clipe ${r.L.larg.toFixed(1)} × ${r.L.alt.toFixed(1)} × ${r.alturaTotal.toFixed(1)} mm, cabeça de ${r.L.cabecaTam[0].toFixed(1)} × ${r.L.cabecaTam[1].toFixed(1)} mm, fio de ${p.larguraFio} mm com ${p.folga} mm de folga.`,
    };
  },
});
