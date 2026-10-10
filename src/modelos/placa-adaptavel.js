import { criarEditorModelo } from './editor.js';
import { svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { geoPlacaAdaptavel, layoutPlacaAdaptavel } from './geo.js';
import { deslizante, numero, arquivo, escolha, el, texto, aoMudar, secao } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

function campoArte(s, rotulo, dica, aoTrocar) {
  const mini = el('img', { class: 'miniatura', alt: rotulo }); mini.hidden = true;
  let atual = null;
  const campo = arquivo(s, rotulo, '.svg,.png,.jpg,.jpeg,.webp', async f => {
    atual = /\.svg$/i.test(f.name) ? { tipo: 'svg', dado: await f.text() } : { tipo: 'img', dado: await lerImagem(f, 900) };
    mini.src = URL.createObjectURL(f); mini.hidden = false; btn.hidden = false; aoTrocar(atual);
  }, { dica });
  const btn = el('button', { class: 'btn-mini', type: 'button', text: 'Remover' }); btn.hidden = true;
  btn.addEventListener('click', () => { atual = null; mini.hidden = true; mini.src = ''; btn.hidden = true; try { campo.value = ''; } catch {} aoTrocar(null); });
  s.append(mini); s.append(btn);
}

export default criarEditorModelo({
  id: 'placa-adaptavel', exemplo: ['arte'], nome: 'Placa Adaptável (forma da arte)',
  descricao: 'Placa no formato da sua arte, sem argola nem encaixe: a arte da frente sai em relevo (ou rente) e, se quiser, outra arte fica nivelada no verso.',
  partes: [
    { id: 'base', nome: 'Base / borda', cor: 0x2b3437 },
    { id: 'frente', nome: 'Arte da frente', cor: 0x111111 },
    { id: 'verso', nome: 'Arte do verso', cor: 0xe2bf5f },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null; this.arteVerso = null;
    campoArte(s, 'Arte da frente (SVG ou PNG)', 'O contorno dela vira o formato da placa.', a => { this.arte = a; mudou(); });
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.acabamento = escolha(s, 'Acabamento da frente', [['relevo', 'Em relevo'], ['rente', 'Rente à base']], 'relevo');
    this.faces = escolha(s, 'Faces', [['frente', 'Só frente'], ['ambas', 'Frente e verso']], 'frente',
      { dica: 'No verso a arte fica nivelada (embutida no fundo), lida certinho olhando a placa por trás.' });
    this.origemVerso = escolha(s, 'Arte do verso', [['mesma', 'A mesma da frente'], ['outra', 'Outra arte']], 'mesma');
    campoArte(s, 'Outra arte pro verso (SVG ou PNG)', 'Só vale com "Outra arte".', a => { this.arteVerso = a; mudou(); });
    aoMudar([this.limiar, this.acabamento, this.faces, this.origemVerso], mudou);
    texto(s, 'Com frente e verso, a prévia mostra as duas faces lado a lado.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sp = secao(raiz, 'Placa');
    this.tamanho = d(sp, 'Largura da arte', 62.5, { min: 15, max: 200, passo: 0.5, dica: 'Maior lado da arte da frente (sem a borda).' });
    this.rotArte = deslizante(sp, 'Rotação da arte', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.borda = d(sp, 'Largura de borda', 2.4, { min: 0.8, max: 10, passo: 0.1 });
    this.espBase = d(sp, 'Espessura da base', 2.4, { min: 1.2, max: 8, passo: 0.1 });
    this.relevo = d(sp, 'Relevo da frente', 0.6, { min: 0.2, max: 4, passo: 0.1 });
    this.fecho = d(sp, 'Suavizar contorno', 1, { min: 0, max: 12, passo: 0.5 });
    this.chanfro = d(sp, 'Chanfro embaixo (só frente)', 0.3, { min: 0, max: 0.8, passo: 0.1 });

    const sv = secao(raiz, 'Verso');
    this.profVerso = d(sv, 'Profundidade do verso', 0.6, { min: 0.2, max: 2, passo: 0.1, dica: 'Quantas camadas a arte do verso ocupa no fundo.' });
    this.tamVerso = d(sv, 'Tamanho da outra arte', 40, { min: 5, max: 200, passo: 0.5 });
    this.rotVerso = deslizante(sv, 'Rotação da outra arte', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.versoX = d(sv, 'Ajuste horizontal', 0, { min: -60, max: 60, passo: 0.5 });
    this.versoY = d(sv, 'Ajuste vertical', 0, { min: -60, max: 60, passo: 0.5 });
  },
  async cs(a) {
    if (!a) return null;
    return a.tipo === 'svg' ? svgParaSecao(a.dado, { largura: 60, ignorarBranco: true }) : imagemParaSecao(a.dado, { limiar: this.limiar(), largura: 60 });
  },
  async formas() {
    const arte = await this.cs(this.arte);
    if (!arte) throw new Error('Envie a arte da frente (SVG ou PNG): o formato da placa vem dela.');
    const verso = this.origemVerso() === 'outra' ? await this.cs(this.arteVerso) : 'mesma';
    return { arte, verso: verso || 'mesma' };
  },
  parametros() {
    const k = ['tamanho', 'rotArte', 'borda', 'espBase', 'relevo', 'fecho', 'chanfro', 'profVerso', 'tamVerso', 'rotVerso', 'versoX', 'versoY'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.acabamento = this.acabamento(); p.faces = this.faces();
    return p;
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutPlacaAdaptavel(f, p);
    const partes = [{ id: 'base', poligonos: poligonosDe(L.base) }, { id: 'frente', poligonos: poligonosDe(L.arte) }];
    let largura = L.larg + 20;
    if (L.verso) {
      // vista de trás ao lado: placa espelhada + arte do verso como ela é vista
      const dx = L.larg + 12, b = L.base.bounds(), cx = (b.min[0] + b.max[0]) / 2;
      const desl = cs => cs.mirror([1, 0]).translate([2 * cx + dx, 0]);
      const mover = cs => cs.translate([-dx / 2, 0]);
      partes.forEach(q => { q.poligonos = poligonosDe(mover(q.id === 'base' ? L.base : L.arte)); });
      partes.push({ id: 'base', poligonos: poligonosDe(mover(desl(L.base))) }, { id: 'verso', poligonos: poligonosDe(mover(desl(L.verso))) });
      largura = 2 * L.larg + 32;
    }
    return {
      largura, altura: L.alt + 20, partes,
      dica: (L.verso ? 'Esquerda: frente. Direita: verso (como fica olhando por trás). ' : '') + 'Clique numa peça pra trocar a cor.'
        + (L.fechoUsado > p.fecho ? ` Contorno suavizado em ${L.fechoUsado} mm pra virar uma peça só.` : ''),
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoPlacaAdaptavel(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Placa ${r.larg.toFixed(1)} × ${r.alt.toFixed(1)} × ${r.alturaTotal.toFixed(1)} mm, ${r.partes.length} volumes`
        + (this.faces() === 'ambas' ? ', arte nivelada no verso (fica pra baixo na mesa, sai lisinha).' : '.'),
    };
  },
});
