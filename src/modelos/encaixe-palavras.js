import { criarEditorModelo } from './editor.js';
import { comandosParaPoligonos } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoEncaixe, layoutEncaixe } from './geo.js';
import { deslizante, campoTexto, marcar, texto, aoMudar, secao } from '../core/ui.js';
import { M } from '../core/motor.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);
const escalaMaiuscula = (font, h) => { const r = font.charToGlyph('H').getPath(0, 0, 100).getBoundingBox(); return h / ((r.y2 - r.y1) || 70); };
const csDe = (font, cmds, s) => { const p = comandosParaPoligonos(cmds); return p.length ? new (M().CrossSection)(p, 'NonZero').scale([s, s]) : null; };

export default criarEditorModelo({
  id: 'encaixe-palavras', nome: 'Palavras Encaixadas (decoração)',
  descricao: 'Palavra base grossa (ex.: AMOR) com uma segunda frase (ex.: Família) que encaixa num rebaixo em cima dela. Imprime em 2 peças e monta por encaixe, sem cola.',
  partes: [
    { id: 'base', nome: 'Palavra base', cor: 0x2496d3 },
    { id: 'frase', nome: 'Segunda frase', cor: 0xfdf6e8 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.palavra = campoTexto(s, 'Palavra base', 'AMOR');
    this.fonteBase = seletorFonte(s, 'Fonte da palavra base', 'emb:Cinzel-Variavel.ttf', { aoMudar: mudou, dica: 'Serifadas grossas ficam lindas (Cinzel, Alfa Slab).' });
    this.frase = campoTexto(s, 'Segunda frase', 'Família', { dica: 'Deixe vazio pra imprimir só a palavra base.' });
    this.fonteFrase = seletorFonte(s, 'Fonte da segunda frase', 'emb:Pacifico-Regular.ttf', { aoMudar: mudou });
    aoMudar([this.palavra, this.frase], mudou);
    texto(s, 'No 2D, arraste a segunda frase pra posicionar sobre a palavra base. O rebaixo do encaixe acompanha sozinho.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sb = secao(raiz, 'Palavra base');
    this.alturaBase = d(sb, 'Altura da palavra base', 50, { min: 15, max: 150, passo: 0.5, dica: 'Altura de uma letra maiúscula.' });
    this.uniao = d(sb, 'União da palavra base', 2, { min: 0, max: 15, passo: 0.25, dica: 'Depois de encostar, quanto cada letra ainda entra na anterior (a palavra sai numa peça só).' });
    this.espBase = d(sb, 'Espessura da palavra base', 10, { min: 4, max: 30, passo: 0.5 });
    this.engrossarBase = d(sb, 'Engrossar letras', 0.6, { min: 0, max: 3, passo: 0.1, dica: 'Deixa as hastes finas da fonte mais firmes.' });

    const sf = secao(raiz, 'Segunda frase');
    this.alturaFrase = d(sf, 'Altura da segunda frase', 30, { min: 6, max: 100, passo: 0.5 });
    this.espFrase = d(sf, 'Espessura da segunda frase', 3, { min: 1.2, max: 10, passo: 0.2, dica: 'Parte que fica pra fora, por cima da palavra base.' });
    this.fraseX = d(sf, 'Posição horizontal', 0, { min: -150, max: 150, passo: 0.5 });
    this.fraseY = d(sf, 'Posição vertical', 0, { min: -80, max: 80, passo: 0.5 });
    this.ligarSoltos = marcar(sf, 'Ligar pingos/acentos soltos', true, { dica: 'Pingo ou acento que cai num vão da palavra base ganha uma pontezinha até a letra mais perto (senão cairia).' });
    this.ligarSoltos.input.addEventListener('change', mudou);

    const se = secao(raiz, 'Encaixe');
    this.profEncaixe = d(se, 'Profundidade do encaixe', 2.4, { min: 0.8, max: 8, passo: 0.2 });
    this.folga = d(se, 'Tolerância', 0.3, { min: 0.05, max: 1, passo: 0.05, dica: 'Folga em volta do pino da frase. PETG: 0.3; se ficar justo, aumente.' });
  },
  async formas() {
    const fb = await obterFonte(this.fonteBase()), ff = await obterFonte(this.fonteFrase());
    const palavra = (this.palavra() || '').trim();
    if (!palavra) throw new Error('Digite a palavra base.');
    const sb = escalaMaiuscula(fb, this.alturaBase());
    const letras = [...palavra].map(ch => /\s/.test(ch) ? null : csDe(fb, fb.charToGlyph(ch).getPath(0, 0, 100).commands, sb));
    const fr = (this.frase() || '').trim();
    const frase = fr ? csDe(ff, ff.getPath(fr, 0, 0, 100).commands, escalaMaiuscula(ff, this.alturaFrase())) : null;
    return { letras, frase };
  },
  parametros() {
    const k = ['alturaBase', 'uniao', 'espBase', 'engrossarBase', 'alturaFrase', 'espFrase', 'fraseX', 'fraseY', 'profEncaixe', 'folga'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.ligarSoltos = !!this.ligarSoltos();
    return p;
  },
  arrastar(id, dx, dy) {
    if (id !== 'frase') return;
    this.fraseX.definir(+(this.fraseX() + dx).toFixed(1));
    this.fraseY.definir(+(this.fraseY() + dy).toFixed(1));
  },
  async compor2D(ctx) {
    const L = layoutEncaixe(await this.formas(), this.parametros());
    const partes = [{ id: 'base', poligonos: poligonosDe(L.base) }];
    if (L.frase) partes.push({ id: 'frase', movel: true, poligonos: poligonosDe(L.frase) });
    return {
      largura: L.larg + 30, altura: L.alt + 30, partes,
      dica: `Composição montada: ${L.larg.toFixed(1)} × ${L.alt.toFixed(1)} mm. Arraste a segunda frase pra posicionar.`
        + (L.soltos ? ` ⚠ ${L.soltos} pedaço(s) da frase não encostam na palavra base (ficariam soltos): mova a frase.` : ''),
    };
  },
  async gerar(ctx) {
    const p = this.parametros();
    const r = geoEncaixe(await this.formas(), p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.montado,
      montado: r.montado.map(([id, m]) => [id, m, [cx, cy, 0]]),
      imprimir: r.imprimir,
      resumo: `Composição montada ${r.L.larg.toFixed(1)} × ${r.L.alt.toFixed(1)} mm, ${r.alturaTotal.toFixed(1)} mm de altura. `
        + (r.L.frase ? `Encaixe automático de ${r.enc.toFixed(1)} mm com tolerância de ${p.folga.toFixed(2)} mm. Os arquivos saem com as 2 peças deitadas: a frase vem de cabeça pra baixo (face da frente na mesa), sem suporte.` : 'Só a palavra base.')
        + (r.L.soltos ? ` ⚠ ${r.L.soltos} pedaço(s) da frase ficam soltos.` : ''),
    };
  },
});
