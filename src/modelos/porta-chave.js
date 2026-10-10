import { criarEditorModelo } from './editor.js';
import { svgDuasCores, imagemDuasCores, lerImagem } from '../core/formas.js';
import { geoPortaChave } from './geo.js';
import { deslizante, numero, arquivo, el, texto } from '../core/ui.js';

const poligonosDe = cs => cs.toPolygons();

export default criarEditorModelo({
  id: 'porta-chave', exemplo: ['arte'], nome: 'Porta chave',
  descricao: 'Envie um PNG ou SVG: vira o desenho colado numa barra com pinos pra pendurar chave e 2 furos de parafuso. Serve pra qualquer imagem.',
  partes: [
    { id: 'corpo', nome: 'Contorno', cor: 0x1c2b36 },
    { id: 'fundo', nome: 'Desenho', cor: 0x0f7c80 },
    { id: 'detalhe', nome: 'Detalhes', cor: 0xffffff },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    arquivo(s, 'Imagem (PNG) ou SVG', '.png,.jpg,.jpeg,.webp,.svg', async f => {
      if (/\.svg$/i.test(f.name) || f.type === 'image/svg+xml') this.arte = { tipo: 'svg', dado: await f.text() };
      else this.arte = { tipo: 'img', dado: await lerImagem(f, 800) };
      mudou();
    }, { aoRemover: () => { this.arte = null; mudou(); } });
    this.limiar = numero(s, 'Limiar preto/branco', 128, { passo: 1, min: 1, max: 254, dica: 'Só pra PNG/JPG: o que for mais escuro que isso vira o desenho; as partes claras internas viram os detalhes.' });
    this.limiar.input.addEventListener('input', mudou);
    this.dicaArte = texto(s, 'Dica: use uma imagem com o desenho escuro e os detalhes (olhos etc.) claros, tipo a caveira.');
  },
  montarParametros(raiz, ctx, mudou) {
    this.largura = deslizante(raiz, 'Largura do desenho', 90, { min: 30, max: 200, un: 'mm', aoMudar: mudou });
    this.espArte = deslizante(raiz, 'Espessura do desenho', 4, { min: 2, max: 10, un: 'mm', aoMudar: mudou });
    this.contorno = deslizante(raiz, 'Contorno', 2.5, { min: 0.5, max: 8, un: 'mm', aoMudar: mudou, dica: 'A borda escura em volta do desenho, igual à luminária.' });
    this.espDet = deslizante(raiz, 'Profundidade dos detalhes', 2, { min: 0.6, max: 5, un: 'mm', aoMudar: mudou, dica: 'Quanto os detalhes claros afundam. Menor deixa a peça de cor mais fina.' });
    this.pinos = deslizante(raiz, 'Pinos pra chave', 5, { min: 1, max: 12, passo: 1, aoMudar: mudou });
    this.diamPino = deslizante(raiz, 'Grossura do pino', 4, { min: 2, max: 8, un: 'mm', aoMudar: mudou });
    this.compPino = deslizante(raiz, 'Comprimento do pino', 12, { min: 6, max: 25, un: 'mm', aoMudar: mudou });
    this.altBarra = deslizante(raiz, 'Altura da barra', 20, { min: 10, max: 40, un: 'mm', aoMudar: mudou });
    this.largBarra = deslizante(raiz, 'Largura da barra', 90, { min: 50, max: 130, un: '%', aoMudar: mudou, dica: 'Largura da barra em relação ao desenho.' });
    this.espBarra = deslizante(raiz, 'Espessura da barra', 5, { min: 3, max: 12, un: 'mm', aoMudar: mudou });
    this.furo = deslizante(raiz, 'Furo do parafuso', 4, { min: 2, max: 8, un: 'mm', aoMudar: mudou });
    this.raio = deslizante(raiz, 'Cantos da barra', 3, { min: 0, max: 12, un: 'mm', aoMudar: mudou });
  },
  async formas() {
    if (!this.arte) throw new Error('Escolha um PNG ou SVG pra começar.');
    if (this.arte.tipo === 'svg') return svgDuasCores(this.arte.dado, { largura: this.largura() });
    return imagemDuasCores(this.arte.dado, { limiar: this.limiar(), largura: this.largura() });
  },
  parametros() {
    return { espArte: this.espArte(), espDetalhe: Math.min(this.espDet(), this.espArte() - 0.6), contorno: this.contorno(), larguraBarra: this.largBarra() / 100,
      alturaBarra: this.altBarra(), espBarra: this.espBarra(), raio: this.raio(), furoParafuso: this.furo(),
      pinos: this.pinos(), diamPino: this.diamPino(), compPino: this.compPino() };
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const partes = [
      { id: 'corpo', poligonos: poligonosDe(f.cheio.offset(this.contorno(), 'Round', 2, 24)) },
      { id: 'fundo', poligonos: poligonosDe(f.cheio) },
    ];
    if (f.detalhe && !f.detalhe.isEmpty()) partes.push({ id: 'detalhe', poligonos: poligonosDe(f.detalhe) });
    const [w, h] = [f.cheio.bounds().max[0] - f.cheio.bounds().min[0], f.cheio.bounds().max[1] - f.cheio.bounds().min[1]];
    return { largura: w + 40, altura: h + this.altBarra() + 40, partes, dica: 'Confira o desenho. Clique no quadradinho de cor de cada peça pra trocar.' };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoPortaChave({ cheio: f.cheio, detalhe: f.detalhe }, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: `Porta chave ${r.W.toFixed(0)} × ${r.H.toFixed(0)} mm, ${Math.round(this.pinos())} pino(s). Imprime deitado; furos de parafuso na barra.`,
    };
  },
});
