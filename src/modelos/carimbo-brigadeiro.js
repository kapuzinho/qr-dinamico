import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoCarimbos, artesCarimbo } from './geo.js';
import { deslizante, numero, arquivo, marcar, el, texto, aoMudar, secao } from '../core/ui.js';
import { M } from '../core/motor.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);
const MAX = 6;

export default criarEditorModelo({
  id: 'carimbo-brigadeiro', exemplo: ['artes'], nome: 'Carimbos para Brigadeiro',
  descricao: 'Carimbos de cabo torneado pra marcar brigadeiro, chocolate e massinha. Até 6 artes (SVG ou PNG), um carimbo por arte, todos na mesma mesa.',
  partes: [
    { id: 'corpo', nome: 'Cabo', cor: 0xdb4b55 },
    { id: 'arte', nome: 'Arte (relevo)', cor: 0xf7efe5 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.artes = Array(MAX).fill(null);
    for (let i = 0; i < MAX; i++) {
      const mini = el('img', { class: 'miniatura', alt: `Arte ${i + 1}` }); mini.hidden = true;
      const campo = arquivo(s, `Arte ${i + 1} (SVG ou PNG)${i ? ' – opcional' : ''}`, '.svg,.png,.jpg,.jpeg,.webp', async f => {
        this.artes[i] = /\.svg$/i.test(f.name) ? { tipo: 'svg', dado: await f.text() } : { tipo: 'img', dado: await lerImagem(f, 800) };
        mini.src = URL.createObjectURL(f); mini.hidden = false; btn.hidden = false; mudou();
      });
      const btn = el('button', { class: 'btn-mini', type: 'button', text: `Remover arte ${i + 1}` }); btn.hidden = true;
      btn.addEventListener('click', () => { this.artes[i] = null; mini.hidden = true; mini.src = ''; btn.hidden = true; try { campo.value = ''; } catch {} mudou(); });
      s.append(mini); s.append(btn);
    }
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.espelhar = marcar(s, 'Espelhar a arte (a marca sai certa)', true, { dica: 'Carimbo marca ao contrário: espelhando, o desenho/texto aparece certo no doce.' });
    aoMudar([this.limiar, this.espelhar], mudou);
    texto(s, 'Um carimbo por arte enviada. Imprima em pé, com a arte pra cima. Use filamento próprio pra alimento (PETG/PLA food safe) e lave antes de usar.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sa = secao(raiz, 'Arte');
    this.tamArte = d(sa, 'Largura da arte', 12.9, { min: 4, max: 40, passo: 0.1, dica: 'Maior lado da arte. É cortada na área útil da face.' });
    this.relevo = d(sa, 'Relevo da arte', 3, { min: 0.6, max: 6, passo: 0.1, dica: 'Profundidade da marca no doce.' });
    this.rotArte = deslizante(sa, 'Rotação', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.margem = d(sa, 'Margem da borda', 1, { min: 0, max: 5, passo: 0.25 });
    const sc = secao(raiz, 'Cabo');
    this.diametro = d(sc, 'Diâmetro da face', 20, { min: 12, max: 50, passo: 0.5 });
    this.alturaCabo = d(sc, 'Altura do cabo', 30, { min: 15, max: 60, passo: 0.5 });
    this.espaco = d(sc, 'Espaço entre carimbos', 8, { min: 3, max: 30, passo: 0.5 });
  },
  async formas() {
    return this.artes.map(a => !a ? null : a.tipo === 'svg'
      ? svgParaSecao(a.dado, { largura: 20, ignorarBranco: true })
      : imagemParaSecao(a.dado, { limiar: this.limiar(), largura: 20 }));
  },
  parametros() {
    const k = ['tamArte', 'relevo', 'rotArte', 'margem', 'diametro', 'alturaCabo', 'espaco'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.espelhar = !!this.espelhar();
    return p;
  },
  async compor2D(ctx) {
    const p = this.parametros();
    const lista = artesCarimbo(await this.formas(), p);
    if (!lista.length) throw new Error('Envie pelo menos uma arte (até 6): cada uma vira um carimbo.');
    const C = M().CrossSection, passo = p.diametro + p.espaco, x0 = -(lista.length - 1) * passo / 2;
    // na prévia a arte aparece como vai ficar NO DOCE (sem espelhar)
    const verDoce = cs => p.espelhar ? cs.mirror([1, 0]) : cs;
    const faces = [], artes = [];
    lista.forEach((it, k) => {
      const x = x0 + k * passo;
      faces.push(C.circle(p.diametro / 2, 96).translate([x, 0]));
      artes.push(verDoce(it.arte).translate([x, 0]));
    });
    return {
      largura: lista.length * passo + 20, altura: p.diametro + 30,
      partes: [{ id: 'corpo', poligonos: poligonosDe(C.union(faces)) }, { id: 'arte', poligonos: poligonosDe(C.union(artes)) }],
      dica: `${lista.length} carimbo(s) · área útil de ${(p.diametro - 2 * p.margem).toFixed(0)} mm. A prévia mostra como a marca fica no doce`
        + (p.espelhar ? ' (no carimbo a arte vai espelhada).' : '.'),
    };
  },
  async gerar(ctx) {
    const p = this.parametros();
    const r = geoCarimbos(await this.formas(), p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `${r.n} carimbo(s) Ø ${p.diametro} × ${(p.alturaCabo + p.relevo).toFixed(1)} mm, relevo de ${p.relevo} mm${p.espelhar ? ', arte espelhada' : ''}. Imprime em pé, arte pra cima.`,
    };
  },
});
