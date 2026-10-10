import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem, tamanho } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoPlaca, geoPlacaSolida, geoPlacaLetrasSoltas, comporPlaca } from './geo.js';
import { campoTexto, deslizante, escolha, arquivo, el, aoMudar } from '../core/ui.js';

function poligonosDe(cs) { return cs.toPolygons(); }

export default criarEditorModelo({
  id: 'placa-profissao', exemplo: ['svg'], temArte(artes) { return artes.length > 0 && this.conteudo() === 'simbolo'; }, nome: 'Placa de profissão',
  descricao: 'Símbolo, nome e profissão numa placa com base. Ajuste tudo nos controles, clique em cada peça pra escolher a cor e baixe em .3mf.',
  partes: [
    { id: 'nome', nome: 'Nome', cor: 0xffffff },
    { id: 'profissao', nome: 'Profissão', cor: 0x0f7c80 },
    { id: 'simbolo', nome: 'Símbolo', cor: 0xffffff },
    { id: 'painel', nome: 'Painel', cor: 0x1c2b36 },
    { id: 'base', nome: 'Base', cor: 0x1c2b36 },
    { id: 'placa', nome: 'Placa das letras', cor: 0x1c2b36 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.svg = null;
    this.conteudo = escolha(s, 'Conteúdo', [['nome', 'Só o nome'], ['simbolo', 'Nome + símbolo']], 'simbolo',
      { dica: 'Escolha se a placa tem só o nome ou também um símbolo/logo.' });
    this.nomeTxt = campoTexto(s, 'Nome', 'Nome', {});
    this.profTxt = campoTexto(s, 'Profissão', 'Profissão', {});
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Cinzel-Variavel.ttf', { aoMudar: mudou });
    arquivo(s, 'Símbolo (SVG ou imagem)', '.svg,.png,.jpg,.jpeg', async f => {
      if (/\.svg$/i.test(f.name)) this.svg = { tipo: 'svg', dado: await f.text() };
      else this.svg = { tipo: 'img', dado: await lerImagem(f, 700) };
      mudou();
    }, { dica: 'Opcional. Use um SVG de ícone da profissão ou envie o seu.', aoRemover: () => { this.svg = null; mudou(); } });
    aoMudar([this.nomeTxt, this.profTxt, this.conteudo], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    this.modo = escolha(raiz, 'Acabamento', [['relevo', 'Em relevo'], ['rente', 'Rente à base']], 'relevo');
    this.base = escolha(raiz, 'Formato', [['solida', 'Base sólida (nome em cima)'], ['soltas', 'Letras soltas (encaixam na base)'], ['painel', 'Painel na base (fenda)'], ['deitada', 'Placa deitada']], 'solida');
    this.posSimbolo = escolha(raiz, 'Posição do símbolo', [['esquerda', 'Esquerda do nome'], ['direita', 'Direita do nome']], 'esquerda');
    this.alinhProf = escolha(raiz, 'Alinhar profissão', [['esquerda', 'Esquerda'], ['centro', 'Centro'], ['direita', 'Direita']], 'centro');
    this.altNome = deslizante(raiz, 'Altura do nome', 16, { min: 6, max: 40, un: 'mm', aoMudar: mudou });
    this.altProf = deslizante(raiz, 'Altura da profissão', 10, { min: 4, max: 30, un: 'mm', aoMudar: mudou });
    this.altSimbolo = deslizante(raiz, 'Altura do símbolo', 55, { min: 15, max: 120, un: 'mm', aoMudar: mudou });
    this.relevo = deslizante(raiz, 'Altura do relevo', 2, { min: 0.6, max: 6, un: 'mm', aoMudar: mudou });
    this.margem = deslizante(raiz, 'Margem da borda', 6, { min: 1, max: 20, un: 'mm', aoMudar: mudou });
    this.raio = deslizante(raiz, 'Cantos', 4, { min: 0, max: 20, un: 'mm', aoMudar: mudou });
    this.espPainel = deslizante(raiz, 'Espessura do painel/placa', 5, { min: 2, max: 12, un: 'mm', aoMudar: mudou });
    this.espLetra = deslizante(raiz, 'Espessura das letras', 10, { min: 3, max: 20, un: 'mm', aoMudar: mudou });
    this.espSimbolo = deslizante(raiz, 'Espessura do símbolo', 6, { min: 3, max: 20, un: 'mm', aoMudar: mudou });
    this.fendaY = deslizante(raiz, 'Posição do painel na base', 0, { min: -20, max: 20, un: 'mm', aoMudar: mudou, dica: 'Frente/trás: onde o painel encaixa na base. 0 = meio.' });
    this.baseFina = deslizante(raiz, 'Base fina das letras', 3, { min: 1, max: 10, un: 'mm', aoMudar: mudou, dica: 'Só no formato "Letras soltas": a espessura da tirinha visível onde as letras ficam coladas.' });
    this.baseAlt = deslizante(raiz, 'Altura da base', 10, { min: 6, max: 40, un: 'mm', aoMudar: mudou });
    this.baseProf = deslizante(raiz, 'Profundidade da base', 30, { min: 12, max: 80, un: 'mm', aoMudar: mudou });
    aoMudar([this.modo, this.base], mudou);
  },
  async simboloCs() {
    if (this.conteudo() === 'nome' || !this.svg) return null;
    if (this.svg.tipo === 'svg') return svgParaSecao(this.svg.dado, { altura: this.altSimbolo() });
    return imagemParaSecao(this.svg.dado, { altura: this.altSimbolo(), largura: 0 });
  },
  async formas() {
    const fonte = await obterFonte(this.fonte());
    return {
      nome: textoParaSecao(fonte, this.nomeTxt() || ' ', { altura: this.altNome() }),
      profissao: this.profTxt().trim() ? textoParaSecao(fonte, this.profTxt(), { altura: this.altProf() }) : null,
      simbolo: await this.simboloCs(),
    };
  },
  parametros() {
    return { alturaNome: this.altNome(), margem: this.margem(), raio: this.raio(), relevo: this.relevo(),
      espPainel: this.espPainel(), espLetra: this.espLetra(), espSimbolo: this.espSimbolo(), modo: this.modo(), base: this.base(), baseProf: this.baseProf(), baseAlt: this.baseAlt(), folga: 0.3, fendaY: this.fendaY(), alinhProf: this.alinhProf(), posSimbolo: this.posSimbolo(), baseFina: this.baseFina() };
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const c = comporPlaca(f, p);
    const W = c.larguraConteudo + 2 * p.margem, H = c.alturaConteudo + 2 * p.margem;
    const desl = cs => cs.translate([-W / 2 + p.margem, -H / 2 + p.margem]);
    const { M } = await import('../core/motor.js');
    const painel = M().CrossSection ? null : null;
    const partes = [{ id: 'painel', poligonos: poligonosDe((await import('./geo.js')).retArred(W, H, p.raio)) }];
    partes.push({ id: 'nome', poligonos: poligonosDe(desl(c.nome)) });
    if (c.profissao) partes.push({ id: 'profissao', poligonos: poligonosDe(desl(c.profissao)) });
    if (c.simbolo) partes.push({ id: 'simbolo', poligonos: poligonosDe(desl(c.simbolo)) });
    return { largura: W + 20, altura: H + 20, partes, dica: 'Ajuste nos controles à direita. Clique numa peça pra escolher a cor.' };
  },
  async gerarSoltas(ctx, p) {
    const r = geoPlacaLetrasSoltas(await this.formas(), p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Placa ${r.W.toFixed(0)} mm. Letras soltas encaixam no rasgo da base. Imprima as letras (com o suporte) e a base separadas.`,
    };
  },
  async gerarSolida(ctx, p) {
    const r = geoPlacaSolida(await this.formas(), p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Placa ${r.W.toFixed(0)} mm de largura, base sólida. Letras e símbolo em pé — imprime tudo junto, base na mesa.`,
    };
  },
  async gerar(ctx) {
    const p = this.parametros();
    if (p.base === 'solida') return this.gerarSolida(ctx, p);
    if (p.base === 'soltas') return this.gerarSoltas(ctx, p);
    const r = geoPlaca(await this.formas(), p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    let montado;
    if (r.montarEmPe) {
      const bh = r.params.baseAlt;
      // painel em pé, encaixado na fenda do meio da base (some pra dentro em 'insercao')
      const girado = r.partes.map(([id, m]) => [id, m.rotate([90, 0, 0])]);
      // menor z entre todas as peças giradas = base do painel; leva ela pro fundo da fenda
      const zMin = Math.min(...girado.map(([, m]) => m.boundingBox().min[2]));
      const emPe = m => m.translate([0, r.params.espPainel / 2 + r.fendaY, bh - r.insercao - zMin]);
      const painelParts = girado.map(([id, m]) => [id, emPe(m), [cx, cy, 0]]);
      montado = [...painelParts, ['base', r.base, [cx, cy, 0]]];
    } else {
      montado = r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]);
    }
    return {
      partes: r.montarEmPe ? [...r.partes, ['base', r.base]] : r.partes,
      montado,
      resumo: `Placa ${r.W.toFixed(0)} × ${r.H.toFixed(0)} mm. ${r.montarEmPe ? 'Painel e base imprimem deitados e encaixam.' : 'Imprime deitada.'}`,
    };
  },
});
