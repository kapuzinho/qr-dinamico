// Dois modelos com a mesma base (ícone + linha grande + linhas menores, formatos e furos):
//  - Plaquinha de nascimento (porta de maternidade)   - Placa de número de casa/apartamento
import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoPlacaInfo, layoutPlacaInfo } from './geo.js';
import { deslizante, numero, arquivo, escolha, marcar, campoTexto, areaTexto, texto, aoMudar, secao } from '../core/ui.js';
import { GALERIA } from '../core/galeria.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

function criarPlacaInfo(o) {
  return criarEditorModelo({
    id: o.id, nome: o.nome, descricao: o.descricao, exemplo: o.arteInicial ? ['arte'] : undefined, exemploSvg: o.arteInicial,
    partes: [
      { id: 'base', nome: 'Placa', cor: o.cores[0] },
      { id: 'conteudo', nome: 'Textos e ícone', cor: o.cores[1] },
      { id: 'moldura', nome: 'Moldura', cor: o.cores[2] },
    ],
    montarConteudo(s, ctx, mudou) {
      this.arte = null;
      this.principal = campoTexto(s, o.rotPrincipal, o.principal);
      this.fontePrincipal = seletorFonte(s, 'Fonte do texto grande', o.fonte1, { aoMudar: mudou });
      this.linhasTxt = areaTexto(s, o.rotLinhas, o.linhas, { linhas: 4, dica: 'Uma informação por linha.' });
      this.fonteLinhas = seletorFonte(s, 'Fonte das linhas', o.fonte2, { aoMudar: mudou });
      arquivo(s, 'Ícone (SVG ou PNG)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
        this.arte = /\.svg$/i.test(f.name) ? { tipo: 'svg', dado: await f.text() } : { tipo: 'img', dado: await lerImagem(f, 800) };
        mudou();
      }, { aoRemover: () => { this.arte = null; mudou(); } });
      this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
      this.forma = escolha(s, 'Formato', [['arredondada', 'Retangular arredondada'], ['oval', 'Oval'], ['circulo', 'Redonda'], ['nuvem', 'Nuvem'], ['contorno', 'Contorno do conteúdo']], o.forma);
      this.furos = escolha(s, 'Furos', [['nenhum', 'Sem furo (fita dupla face)'], ['pendurar', '2 em cima (pendurar com fita)'], ['centro', '1 em cima no meio'], ['parafuso', '4 cantos (parafuso)']], o.furos);
      this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Em relevo'], ['rente', 'Rente à placa']], 'relevo');
      aoMudar([this.principal, this.linhasTxt, this.limiar, this.forma, this.furos, this.acabamento], mudou);
      texto(s, o.dica);
    },
    montarParametros(raiz, ctx, mudou) {
      const d = (r, rot, v, op) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...op });
      const st = secao(raiz, 'Conteúdo');
      this.alturaPrincipal = d(st, 'Altura do texto grande', o.alturaPrincipal, { min: 5, max: 150, passo: 0.5 });
      this.alturaLinhas = d(st, 'Altura das linhas', o.alturaLinhas, { min: 3, max: 40, passo: 0.5 });
      this.larguraTexto = d(st, 'Largura máxima', o.largura, { min: 30, max: 240, passo: 1 });
      this.tamArte = d(st, 'Tamanho do ícone', o.tamArte, { min: 5, max: 120, passo: 0.5 });
      this.espaco = d(st, 'Espaço entre linhas', o.espaco, { min: 0.5, max: 20, passo: 0.5 });
      this.conteudoY = d(st, 'Ajuste vertical', 0, { min: -40, max: 40, passo: 0.5 });
      this.relevo = d(st, 'Relevo', 1.2, { min: 0.4, max: 5, passo: 0.1 });
      const sp = secao(raiz, 'Placa');
      this.margem = d(sp, 'Margem', o.margem, { min: 2, max: 40, passo: 0.5 });
      this.raio = d(sp, 'Cantos (retangular)', 10, { min: 0, max: 60, passo: 0.5 });
      this.borda = d(sp, 'Borda (contorno)', 3, { min: 1, max: 15, passo: 0.5 });
      this.espBase = d(sp, 'Espessura', o.esp, { min: 1.6, max: 12, passo: 0.2 });
      this.moldura = d(sp, 'Moldura em relevo (largura)', o.moldura, { min: 0, max: 12, passo: 0.5, dica: '0 = sem moldura.' });
      this.relevoMoldura = d(sp, 'Altura da moldura', 1.2, { min: 0.4, max: 5, passo: 0.1 });
      this.furo = d(sp, 'Diâmetro do furo', o.furo, { min: 2, max: 10, passo: 0.25 });
      this.escarear = marcar(sp, 'Escarear (cabeça do parafuso embutida)', true);
    },
    async formas() {
      const p1 = (this.principal() || '').trim();
      const principal = p1 ? textoParaSecao(await obterFonte(this.fontePrincipal()), p1, { altura: 10 }) : null;
      const f2 = await obterFonte(this.fonteLinhas());
      const linhas = (this.linhasTxt() || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => textoParaSecao(f2, l, { altura: 10 }));
      const arte = this.arte ? (this.arte.tipo === 'svg' ? svgParaSecao(this.arte.dado, { largura: 30, ignorarBranco: true }) : imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 30 })) : null;
      return { principal, linhas, arte };
    },
    parametros() {
      const k = ['alturaPrincipal', 'alturaLinhas', 'larguraTexto', 'tamArte', 'espaco', 'conteudoY', 'relevo', 'margem', 'raio', 'borda', 'espBase', 'moldura', 'relevoMoldura', 'furo'];
      const p = Object.fromEntries(k.map(n => [n, this[n]()]));
      p.forma = this.forma(); p.furos = this.furos(); p.acabamento = this.acabamento(); p.escarear = !!this.escarear();
      return p;
    },
    async compor2D(ctx) {
      const p = this.parametros();
      const L = layoutPlacaInfo(await this.formas(), p);
      const partes = [{ id: 'base', poligonos: poligonosDe(L.base) }];
      if (L.moldura) partes.push({ id: 'moldura', poligonos: poligonosDe(L.moldura) });
      partes.push({ id: 'conteudo', poligonos: poligonosDe(L.conteudo) });
      return { largura: L.larg + 20, altura: L.alt + 20, partes, dica: `Placa ${L.larg.toFixed(0)} × ${L.alt.toFixed(0)} mm.` };
    },
    async gerar(ctx) {
      const p = this.parametros();
      const r = geoPlacaInfo(await this.formas(), p);
      const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
      return {
        partes: r.partes, montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
        resumo: `${o.nomeCurto} ${r.L.larg.toFixed(0)} × ${r.L.alt.toFixed(0)} × ${r.alturaTotal.toFixed(1)} mm` + (r.L.furos.length ? `, ${r.L.furos.length} furo(s).` : '.'),
      };
    },
  });
}

export const plaquinhaNascimento = criarPlacaInfo({
  id: 'placa-nascimento', nome: 'Plaquinha de Nascimento (maternidade)', nomeCurto: 'Plaquinha',
  descricao: 'Plaquinha de porta de maternidade/quarto do bebê: ícone, nome grande e as informações do nascimento (data, hora, peso, altura). Formato nuvem, oval, redondo...',
  cores: [0xf7f1e8, 0x7fb7d9, 0xe8b9c8], arteInicial: GALERIA['Bebê']['Pezinho'],
  rotPrincipal: 'Nome do bebê', principal: 'Helena', fonte1: 'emb:Pacifico-Regular.ttf',
  rotLinhas: 'Informações (uma por linha)', linhas: '12/03/2026 · 08:45\n3,250 kg · 49 cm', fonte2: 'emb:Poppins-Bold.ttf',
  forma: 'nuvem', furos: 'pendurar', alturaPrincipal: 22, alturaLinhas: 7, largura: 120, tamArte: 26, espaco: 4, margem: 12, esp: 3, moldura: 0, furo: 4,
  dica: 'Ícones de bebê prontos na Galeria (pezinho, mamadeira, chupeta, ursinho, nuvem). Os furos de cima são pra passar fita.',
});

export const placaNumeroCasa = criarPlacaInfo({
  id: 'placa-numero', nome: 'Placa de Número (casa/apto)', nomeCurto: 'Placa de número',
  descricao: 'Placa de número de casa ou apartamento: número grande, rua/família embaixo e ícone opcional. Furos de parafuso escareados nos cantos.',
  cores: [0x1f2328, 0xf2f2f2, 0xf2f2f2], arteInicial: GALERIA['Profissões']['Casa (imóveis)'],
  rotPrincipal: 'Número', principal: '127', fonte1: 'emb:Poppins-Black.ttf',
  rotLinhas: 'Texto embaixo (opcional)', linhas: 'Família Silva', fonte2: 'emb:Poppins-Bold.ttf',
  forma: 'arredondada', furos: 'parafuso', alturaPrincipal: 60, alturaLinhas: 10, largura: 160, tamArte: 24, espaco: 6, margem: 14, esp: 5, moldura: 3, furo: 4.5,
  dica: 'Pra área externa use PETG ou ASA. Os furos são escareados pra parafuso de cabeça chata.',
});
